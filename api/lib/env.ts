import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

export const env = {
  appId: required("APP_ID"),
  appSecret: required("APP_SECRET"),
  isProduction: process.env.NODE_ENV === "production",
  databaseUrl: required("DATABASE_URL"),
  /** 后台管理密码：由环境变量注入，源码不再硬编码 */
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /** Moonshot(Kimi) API Key：仅后端持有，前端不再接触 */
  moonshotApiKey: process.env.MOONSHOT_API_KEY ?? "",
};
