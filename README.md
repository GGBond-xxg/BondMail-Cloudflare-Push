# BondMail Cloudflare Push

BondMail 的可自部署 FCM 定时唤醒服务。Cloudflare Cron 按用户选择的频率发送高优先级数据消息，Android 应用收到后自行连接邮箱服务器同步邮件。

Worker **不会接触或保存**邮箱账号、OAuth Token、密码和邮件正文。D1 只保存安装标识、FCM Token、同步频率以及访问密钥的 SHA-256 摘要。

## 部署方式

推荐把本仓库直接连接到 Cloudflare Workers Builds。之后推送到 GitHub `main` 分支即可自动部署，D1 中的设备注册不会因为更新代码而丢失。

部署前需要准备：

- 一个 [Firebase 项目](https://console.firebase.google.com/)及 Android 应用 `com.bond.mail`
- 一个 Cloudflare D1 数据库 `bondmail-push-db`
- 三个 Worker Secret：`FIREBASE_SERVICE_ACCOUNT_JSON`、`FIREBASE_CLIENT_CONFIG_JSON`、`pwd`
- 在 `wrangler.jsonc` 中填入自己的 D1 `database_id`

完整的操作路径、API 参数来源、GitHub 连接设置和排错说明见：

**[GitHub 直连 Cloudflare 部署指南](docs/GITHUB_DEPLOY.md)**

## 本地命令

```sh
npm ci
npm run firebase:client-config -- google-services.json
npm run check:config
npm run migrate:remote
npm run deploy
```

`firebase:client-config` 会自动从 Firebase 下载的 `google-services.json` 中提取 BondMail 所需的一行客户端 JSON。真实的 Firebase 文件和服务账号私钥已被 `.gitignore` 排除，禁止提交到 GitHub。

## 接口

- `GET /health`：公开健康检查
- `GET /v1/client-config`：校验 `X-BondMail-Push-Key` 后返回 Firebase 客户端配置
- `POST /v1/devices/register`：注册或更新设备
- `POST /v1/devices/unregister`：删除当前安装的设备记录

## License

MIT
