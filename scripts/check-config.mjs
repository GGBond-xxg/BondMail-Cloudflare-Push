import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const configPath = resolve(process.argv[2] || "wrangler.jsonc");

try {
  const text = await readFile(configPath, "utf8");
  const config = JSON.parse(stripJsonComments(text));
  const database = config.d1_databases?.find((item) => item.binding === "DB");

  assert(config.name === "bondmail-push", 'Worker 名称必须为 "bondmail-push"。');
  assert(config.main === "src/index.js", '入口文件必须为 "src/index.js"。');
  assert(database, '缺少 binding 为 "DB" 的 D1 配置。');
  assert(
    database.database_name === "bondmail-push-db",
    'D1 数据库名称必须为 "bondmail-push-db"。',
  );
  assert(
    database.database_id !== "REPLACE_WITH_YOUR_D1_DATABASE_ID",
    "尚未填写 D1 database_id。请先在 Cloudflare 创建 D1 数据库，再把 ID 写入 wrangler.jsonc。",
  );
  assert(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      database.database_id || "",
    ),
    "D1 database_id 格式不正确，应为 Cloudflare 返回的 UUID。",
  );

  console.log(`配置检查通过：${config.name} -> ${database.database_name}`);
} catch (error) {
  console.error(`配置检查失败：${error.message}`);
  process.exitCode = 1;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stripJsonComments(text) {
  let output = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inString) {
      output += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < text.length && text[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) {
        if (text[index] === "\n") output += "\n";
        index += 1;
      }
      index += 1;
      continue;
    }

    output += char;
  }

  return output.replace(/,\s*([}\]])/g, "$1");
}
