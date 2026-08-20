# GitHub 直连 Cloudflare 部署指南

本文以仓库 [`GGBond-xxg/BondMail-Cloudflare-Push`](https://github.com/GGBond-xxg/BondMail-Cloudflare-Push) 为准。完成一次初始化后，GitHub `main` 分支的后续更新可以由 Cloudflare 自动部署。

## 先了解哪些内容会保存在哪里

| 内容 | 保存位置 | 能否提交 GitHub |
| --- | --- | --- |
| Worker 源码、Cron、D1 绑定名称 | 本仓库 | 可以 |
| D1 `database_id` | `wrangler.jsonc` | 可以，它是资源标识，不是登录密钥 |
| Firebase Admin SDK 私钥 JSON | Cloudflare Worker Secret | **绝对不可以** |
| Firebase 客户端配置 JSON | Cloudflare Worker Secret | 不要提交，按本文生成后直接粘贴 |
| BondMail 访问密钥 `pwd` | Cloudflare Worker Secret | **绝对不可以** |
| FCM Token、同步频率 | Cloudflare D1 | 不在 GitHub 中 |

## 一、准备 Firebase

### 1. 创建项目和 Android 应用

1. 打开 [Firebase 控制台](https://console.firebase.google.com/)并创建项目。
2. 在项目概览中添加 Android 应用。
3. Android 软件包名称必须填写 `com.bond.mail`。
4. 下载 `google-services.json`，保存到本仓库根目录。文件名已在 `.gitignore` 中排除。

官方说明：[将 Firebase 添加到 Android 项目](https://firebase.google.com/docs/android/setup)。

### 2. 取得客户端 API 配置

这里不需要手工创建另一把 API Key。BondMail 使用的以下四个值都在刚下载的 `google-services.json` 中：

| BondMail 字段 | `google-services.json` 来源 |
| --- | --- |
| `projectId` | `project_info.project_id` |
| `senderId` | `project_info.project_number` |
| `applicationId` | 软件包 `com.bond.mail` 对应客户端的 `client_info.mobilesdk_app_id` |
| `apiKey` | 同一客户端的 `api_key[0].current_key` |

安装 [Node.js 20 或更高版本](https://nodejs.org/)，在仓库目录执行：

```sh
npm ci
npm run firebase:client-config -- google-services.json
```

命令会输出一行类似下面的 JSON：

```json
{"projectId":"your-project-id","applicationId":"1:123456789:android:abcdef","apiKey":"your-api-key","senderId":"123456789"}
```

先把整行保存在密码管理器中，稍后作为 `FIREBASE_CLIENT_CONFIG_JSON` Secret 粘贴到 Cloudflare。

### 3. 取得 Firebase Admin SDK 私钥

1. Firebase 控制台进入 **项目设置 → 服务账号**。
2. 选择 **Firebase Admin SDK → 生成新的私钥**。
3. 下载得到完整的 JSON 文件。不要重命名后提交，也不要把内容发到 Issue、构建日志或聊天中。

相关官方文档：

- [Firebase Admin SDK：非 Google 环境使用服务账号](https://firebase.google.com/docs/admin/setup#initialize_the_sdk_in_non-google_environments)
- [Google Cloud：创建和删除服务账号密钥](https://cloud.google.com/iam/docs/keys-create-delete)
- [FCM HTTP v1 API 说明](https://firebase.google.com/docs/cloud-messaging/migrate-v1)
- [FCM API 控制台页面](https://console.cloud.google.com/apis/library/fcm.googleapis.com)（如果发送时报 API 未启用，可在对应 Firebase 项目中启用）

Worker 使用的是 FCM HTTP v1 和服务账号 OAuth，不使用已经废弃的 FCM Legacy Server Key。

## 二、创建 Cloudflare D1

可以使用 Dashboard，也可以用 Wrangler。

### 方法 A：Dashboard

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 打开 **Storage & Databases → D1 SQL database → Create**。
3. 数据库名称填写 `bondmail-push-db`。
4. 创建后复制数据库详情中的 **Database ID**。

### 方法 B：Wrangler

```sh
npx wrangler login
npx wrangler d1 create bondmail-push-db
```

复制命令返回的 `database_id`。D1 官方入门文档：[Get started with D1](https://developers.cloudflare.com/d1/get-started/)。

仓库所有者现有的 D1 ID 已写入 `wrangler.jsonc`，重新连接 GitHub 时可以直接沿用，已有设备注册不会丢失。只有在新 Cloudflare 账户部署或主动新建数据库时，才需要替换：

```json
"database_id": "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

为新数据库的真实 UUID。然后执行：

```sh
npm run check:config
```

看到“配置检查通过”后再提交这个文件。详细配置说明：[Wrangler D1 bindings](https://developers.cloudflare.com/workers/wrangler/configuration/#d1-databases)。

## 三、把 GitHub 仓库连接到 Cloudflare

Cloudflare 官方入口和说明：

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [GitHub integration](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [Build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

操作步骤：

1. Cloudflare Dashboard 打开 **Workers & Pages**。
2. 选择 **Create application → Import a repository**（界面文字可能显示为 Connect to Git）。
3. 授权 Cloudflare GitHub App，只授予本仓库即可。
4. 选择 `GGBond-xxg/BondMail-Cloudflare-Push`。
5. Worker 名称填写 `bondmail-push`，必须与 `wrangler.jsonc` 的 `name` 一致。
6. Production branch 选择 `main`。
7. Root directory 填 `/`。
8. Build command 留空；Deploy command 填 `npm run deploy`。
9. 建议关闭非生产分支自动构建。这个项目有每分钟 Cron，预览部署没有必要。
10. 保存并开始第一次部署。

`npm run deploy` 会先检查 D1 ID，再运行 `wrangler deploy`。如果忘记替换占位符，构建日志会直接说明应修改哪个文件。

如果已经有名为 `bondmail-push` 的 Worker，也可以在该 Worker 的 **Settings → Builds** 中连接仓库。务必继续使用原 D1 `database_id`，否则原设备注册记录不会出现在新数据库中。

## 四、添加三个运行时 Secret

进入 Worker `bondmail-push` 的 **Settings → Variables and Secrets → Add**，逐个添加并选择 **Secret**：

| 名称 | 值 |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase 下载的 Admin SDK 私钥 JSON 全文 |
| `FIREBASE_CLIENT_CONFIG_JSON` | 第一部分工具输出的一行 JSON |
| `pwd` | 自己生成的至少 32 字符随机访问密钥 |

Secret 是 Worker **运行时**变量，不要放在 Workers Builds 的 Build variables 中。官方说明：[Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)。

保存 Secret 后重新部署一次 Worker。`FIREBASE_CLIENT_CONFIG_JSON.projectId` 必须与 Admin SDK JSON 中的 `project_id` 完全相同。

## 五、执行一次 D1 迁移

在本地仓库目录执行：

```sh
npm ci
npx wrangler login
npm run migrate:remote
```

确认应用全部待执行迁移。迁移只需在首次部署或仓库新增迁移文件时运行；重复执行不会重复建表。官方说明：[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)。

Cloudflare 为普通 Git 构建自动生成的默认令牌不一定包含 D1 Edit 权限，因此本项目没有在每次 GitHub 部署时自动迁移数据库。这可以避免构建令牌拥有不必要的数据库写权限。

如果一定要在 CI 中迁移，需要自行创建包含对应账户、Worker 和 D1 权限的 Cloudflare API Token，并作为构建 Secret 使用：

- [创建 Cloudflare API Token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare API Tokens 页面](https://dash.cloudflare.com/profile/api-tokens)

正常部署不需要 Global API Key，也不要使用权限过大的 Global API Key。

## 六、验证部署并连接 BondMail

先访问：

```text
https://bondmail-push.<你的子域>.workers.dev/health
```

应返回：

```json
{"ok":true}
```

再验证访问密钥和 Firebase 客户端配置：

```sh
curl -H "X-BondMail-Push-Key: 你的pwd" https://你的Worker域名/v1/client-config
```

不要把真实 `pwd` 的 curl 命令复制到公开日志。

最后在 BondMail 中打开 **设置 → CF FCM 推送**：

1. 服务域名填写 Worker 的 HTTPS 域名，不要附加接口路径。
2. 访问密钥填写与 Cloudflare `pwd` 完全相同的值。
3. 点击验证并启用。

本仓库的 `wrangler.jsonc` 已保留现有自定义域名 `push.maili.eu.cc`。在新的 Cloudflare 账户部署时，必须把 `routes` 中的域名改成自己已经接入该账户的域名，或删除整个 `routes` 段只使用 `workers.dev`。可参考 [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 七、以后如何更新

首次设置完成后：

1. 修改代码并推送到 GitHub `main`。
2. Cloudflare Workers Builds 自动执行 `npm run deploy`。
3. 只要 `wrangler.jsonc` 继续指向同一个 D1 ID，已有设备注册和同步设置都会保留。
4. 仓库新增 `migrations/*.sql` 时，再手动执行一次 `npm run migrate:remote`。

更换 `pwd` 会立即使旧授权失效，所有用户需要在 BondMail 重新输入新密钥验证。删除或更换 D1 数据库会丢失 Worker 端设备注册，手机需要重新启用 CF FCM 推送。

## 常见问题

| 现象 | 处理方法 |
| --- | --- |
| GitHub 构建提示未填写 D1 ID | 在 `wrangler.jsonc` 替换占位符并推送 |
| `/health` 正常，但注册时报 D1 表不存在 | 执行 `npm run migrate:remote` |
| `/v1/client-config` 返回 401 | 检查请求头中的密钥是否与 Cloudflare `pwd` 完全一致 |
| 返回 Firebase 配置无效 | 确认两个 Firebase JSON 属于同一项目，且 Android 包名为 `com.bond.mail` |
| Cron 不发送 | 检查 Worker Logs、Cron Trigger、Firebase Admin 私钥以及 FCM HTTP v1 API |
| 更新后设备全部消失 | 检查是否误用了新的 D1 `database_id` |
| Cloudflare 无权访问仓库 | 在 GitHub App 设置中为 Cloudflare Workers & Pages 授权本仓库 |
