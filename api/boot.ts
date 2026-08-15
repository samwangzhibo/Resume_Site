import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { readFileSync } from "node:fs";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { getDb } from "./queries/connection";
import { ensureProjectsStore, getProject, ensureDbSeed } from "./queries/projectsStore";
import { getPdf, readPdf, writePdf, removePdf, seedPdfsFromAssets, pdfDiagnostics, getPdfLogs } from "./queries/pdfStore";
import { readArticleFile, syncArticlesFromGit, ensureArticlesStore } from "./queries/articlesSync";
import { projectMaterials, visits } from "@db/schema";
import { ADMIN_PASSWORD } from "./routers";

const app = new Hono<{ Bindings: HttpBindings }>();

/** 启动时确保数据表存在并写入种子数据（幂等，失败不阻塞服务） */
async function ensureSchema() {
  try {
    const db = getDb();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS visits (
      id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
      ua varchar(1024) NULL,
      path varchar(512) NULL,
      referrer varchar(1024) NULL,
      fingerprint varchar(64) NULL,
      session_id varchar(64) NULL,
      ip varchar(255) NULL,
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS conversations (
      id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_id varchar(64) NOT NULL,
      question text NOT NULL,
      answer text NOT NULL,
      source varchar(16) NOT NULL DEFAULT 'ai',
      created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS ai_config (
      id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY,
      \`key\` varchar(64) NOT NULL UNIQUE,
      content text NULL,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    await db.execute(sql`CREATE TABLE IF NOT EXISTS project_materials (
      id varchar(32) NOT NULL PRIMARY KEY,
      label varchar(255) NOT NULL,
      tags text NULL,
      sort_order int NOT NULL DEFAULT 0,
      category varchar(16) NOT NULL DEFAULT 'project',
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    // 用户上传 PDF 的持久副本（base64），跨部署/容器清理不丢
    await db.execute(sql`CREATE TABLE IF NOT EXISTS pdf_blobs (
      id varchar(64) NOT NULL PRIMARY KEY,
      data longtext NOT NULL,
      size int unsigned NOT NULL,
      updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);
    // 兼容已有表：补缺失的列
    try {
      await db.execute(sql`ALTER TABLE project_materials ADD COLUMN category varchar(16) NOT NULL DEFAULT 'project'`);
    } catch {}
    console.log("[db] schema ensured");
    // 数据库可用时种入默认项目与内置 PDF（幂等，不覆盖用户上传内容）
    await ensureDbSeed().catch((err) => console.warn("[db] ensureDbSeed failed:", err));
  } catch (err) {
    console.warn("[db] ensureSchema failed (will retry on next boot):", err);
  }
}
// 数据库暂时不可达时不阻塞启动（前端有静态兜底，材料/文章数据走本地文件）
void ensureSchema().catch((err) => {
  console.error("[ensureSchema] 数据库初始化失败，服务继续以降级模式运行:", err?.message || err);
});
// 冗余保险：任何顶层异常都不能让进程退出
process.on("uncaughtException", (err) => console.error("[boot] uncaughtException:", err?.message || err));
process.on("unhandledRejection", (err) => console.error("[boot] unhandledRejection:", err));

// 文章以部署包内置的 assets/articles 为准（每次部署前已拉好最新仓库）；
// 启动时尝试在线增量拉取，失败/超时自动回退内置版本，绝不空白
void ensureArticlesStore()
  .then(() => syncArticlesFromGit())
  .then(async (r) => {
    if (r.ok) {
      console.log(`[articles] 启动同步: ${r.message}`);
    } else {
      console.warn(`[articles] 在线拉取失败（${r.message}），回退到部署包内置版本`);
      const { restoreBundledArticles } = await import("./queries/articlesSync");
      await restoreBundledArticles();
    }
  })
  .catch(async (err) => {
    console.warn("[articles] 启动同步异常，回退到部署包内置版本:", err?.message || err);
    const { restoreBundledArticles } = await import("./queries/articlesSync");
    await restoreBundledArticles().catch(() => {});
  });

// 启动时把资产目录的 PDF 强制同步到上传目录（覆盖），保证部署快照中的 PDF 直接生效
void seedPdfsFromAssets().catch(() => {});

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));

const visitSchema = z.object({
  ua: z.string().max(1024).optional(),
  path: z.string().max(512).optional(),
  referrer: z.string().max(1024).optional(),
  fingerprint: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
});

app.post("/api/visit", async (c) => {
  try {
    const body = visitSchema.parse(await c.req.json());
    const ip =
      c.req.header("x-forwarded-for") ||
      c.req.header("x-real-ip") ||
      c.req.header("cf-connecting-ip") ||
      "";
    await getDb().insert(visits).values({
      ua: body.ua,
      path: body.path,
      referrer: body.referrer,
      fingerprint: body.fingerprint,
      sessionId: body.sessionId,
      ip,
    });
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 400);
  }
});

/* ============================== 项目材料 PDF 管理（目录存储，部署扫描关联，不用数据库） ============================== */

const MAX_PDF_SIZE = 30 * 1024 * 1024;

function isAdmin(c: { req: { header: (name: string) => string | undefined } }) {
  return c.req.header("x-admin-password") === ADMIN_PASSWORD;
}

/** 诊断接口（公开只读）：查看 PDF 目录状态、四层来源快照与版本，定位线上问题 */
app.get("/api/debug/pdf", async (c) => {
  const diag = await pdfDiagnostics();
  return c.json({ ...diag, version: "v20260812.4" });
});

/** PDF 现场日志（公开只读）：记录每次文件被清理/索引掉/重建的过程，用于线上拉取分析 */
app.get("/api/debug/pdf-logs", async (c) => {
  return c.json({ version: "v20260812.4", count: getPdfLogs().length, logs: getPdfLogs() });
});

/** 获取项目 PDF（公开访问）：从 pdfStore 按 id 读文件 */
app.get("/api/pdfs/:name", async (c) => {
  try {
    const id = decodeURIComponent(c.req.param("name")).replace(/\.pdf$/i, "");
    const buf = await readPdf(id);
    if (!buf) return c.json({ error: "Not Found" }, 404);
    const rec = await getPdf(id);
    const fileName = encodeURIComponent(rec?.fileName || `${id}.pdf`);
    return c.body(new Uint8Array(buf), 200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
      "Content-Length": String(buf.length),
      "Cache-Control": "no-cache",
    });
  } catch {
    return c.json({ error: "Not Found" }, 404);
  }
});

/** 上传 / 替换项目 PDF（需密码）：写入 uploads/pdfs/<id>.pdf */
app.post("/api/projects/:id/pdf", async (c) => {
  if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ ok: false, error: "请选择 PDF 文件" }, 400);
    }
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) return c.json({ ok: false, error: "仅支持 PDF 文件" }, 400);
    if (file.size > MAX_PDF_SIZE) {
      return c.json({ ok: false, error: "文件过大（上限 30MB）" }, 400);
    }
    await ensureProjectsStore();
    const existing = await getProject(id);
    if (!existing) return c.json({ ok: false, error: "项目不存在" }, 404);
    const buf = Buffer.from(await file.arrayBuffer());
    const ok = await writePdf(id, buf);
    if (!ok) return c.json({ ok: false, error: "保存失败，请重试" }, 500);
    return c.json({ ok: true, pdfUrl: `/api/pdfs/${id}.pdf`, pdfSize: buf.length });
  } catch (err) {
    console.error("[pdf-upload] error:", err);
    return c.json({ ok: false, error: "上传失败，请重试" }, 500);
  }
});

/** 移除项目 PDF（需密码）：删除上传目录文件与数据库副本；若为内置 PDF，资产/内置数据兜底会重新出现 */
app.delete("/api/projects/:id/pdf", async (c) => {
  if (!isAdmin(c)) return c.json({ error: "unauthorized" }, 401);
  try {
    const id = c.req.param("id");
    await ensureProjectsStore();
    await removePdf(id);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false, error: "移除失败，请重试" }, 500);
  }
});

/** 文章/图片文件服务（uploads/articles 下的内容，含路径安全校验） */
app.get("/api/articles/file", async (c) => {
  const p = c.req.query("p") || "";
  if (!p) return c.json({ error: "Not Found" }, 404);
  const file = await readArticleFile(p);
  if (!file) return c.json({ error: "Not Found" }, 404);
  return c.body(new Uint8Array(file.buf), 200, {
    "Content-Type": file.contentType,
    "Cache-Control": "no-cache",
  });
});

app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const { serveStaticFiles } = await import("./lib/vite");
  serveStaticFiles(app);

  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
