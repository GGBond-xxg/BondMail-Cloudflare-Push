import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const inputPath = resolve(process.argv[2] || "google-services.json");
const packageName = process.argv[3] || "com.bond.mail";

try {
  const source = JSON.parse(await readFile(inputPath, "utf8"));
  const client = source.client?.find(
    (item) => item.client_info?.android_client_info?.package_name === packageName,
  );

  if (!client) {
    throw new Error(`没有找到软件包 ${packageName}，请确认 Firebase Android 应用的软件包名称。`);
  }

  const result = {
    projectId: required(source.project_info?.project_id, "project_info.project_id"),
    applicationId: required(
      client.client_info?.mobilesdk_app_id,
      "client_info.mobilesdk_app_id",
    ),
    apiKey: required(client.api_key?.[0]?.current_key, "api_key[0].current_key"),
    senderId: required(source.project_info?.project_number, "project_info.project_number"),
  };

  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  console.error(`读取 Firebase 配置失败：${error.message}`);
  process.exitCode = 1;
}

function required(value, path) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`google-services.json 缺少 ${path}`);
  }
  return value.trim();
}
