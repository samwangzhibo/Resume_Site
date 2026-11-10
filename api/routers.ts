import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { aiConfig, conversations, visits } from "@db/schema";
import {
  ensureProjectsStore,
  listProjects,
  updateProjectMeta,
  createProject,
  deleteProject,
  reorderProjects,
} from "./queries/projectsStore";
import {
  listArticles,
  credentialStatus,
  saveCredential,
  syncArticlesFromGit,
  lastSyncedAt,
  getSyncLogs,
  isSyncing,
} from "./queries/articlesSync";

/** 管理后台密码：从环境变量 ADMIN_PASSWORD 读取，源码不再硬编码 */
export const ADMIN_PASSWORD = env.adminPassword;
const KB_KEY = "knowledge_base";

/** 数字分身对话：后端代理 Moonshot(Kimi)，前端不接触 API Key */
export const aiRouter = createRouter({
  chat: publicQuery
    .input(
      z.object({
        messages: z
          .array(
            z.object({
              role: z.enum(["system", "user", "assistant"]),
              content: z.string(),
            }),
          )
          .min(1)
          .max(60),
      }),
    )
    .mutation(async ({ input }) => {
      if (!env.moonshotApiKey) {
        throw new Error("AI 服务未配置（缺少 MOONSHOT_API_KEY）");
      }
      const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.moonshotApiKey}`,
        },
        body: JSON.stringify({
          model: "moonshot-v1-128k",
          messages: input.messages,
          temperature: 0.7,
          max_tokens: 4000,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`AI 调用失败（${res.status}）：${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const answer = data.choices?.[0]?.message?.content?.trim();
      if (!answer) throw new Error("AI 无响应，请稍后重试");
      return { answer };
    }),
});

export const aiConfigRouter = createRouter({
  verifyPassword: publicQuery
    .input(z.object({ password: z.string() }))
    .mutation(({ input }) => {
      return { valid: input.password === ADMIN_PASSWORD };
    }),

  readKnowledgeBase: publicQuery.query(async () => {
    const row = await getDb().query.aiConfig.findFirst({
      where: (t, { eq }) => eq(t.key, KB_KEY),
    });
    return row?.content ?? "";
  }),

  saveKnowledgeBase: publicQuery
    .input(z.object({ content: z.string() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const existing = await db.query.aiConfig.findFirst({
        where: (t, { eq }) => eq(t.key, KB_KEY),
      });
      if (existing) {
        await db.update(aiConfig).set({ content: input.content }).where(eq(aiConfig.key, KB_KEY));
      } else {
        await db.insert(aiConfig).values({ key: KB_KEY, content: input.content });
      }
      return { ok: true };
    }),
});

export const presetsRouter = createRouter({
  recordConversation: publicQuery
    .input(
      z.object({
        sessionId: z.string().max(64),
        question: z.string(),
        answer: z.string(),
        source: z.enum(["preset", "ai"]).default("ai"),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb().insert(conversations).values({
        sessionId: input.sessionId,
        question: input.question,
        answer: input.answer,
        source: input.source,
      });
      return { ok: true };
    }),
});

export const projectsRouter = createRouter({
  /** 项目材料列表（含 PDF 状态），前台与后台共用，可按分类过滤 */
  list: publicQuery
    .input(z.object({ category: z.enum(["project", "research"]).optional() }).optional())
    .query(async ({ input }) => {
      await ensureProjectsStore();
      let rows = await listProjects();
      if (input?.category) rows = rows.filter((r) => r.category === input.category);
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        tags: r.tags,
        category: r.category,
        pdfUrl: r.pdfName ? `/api/pdfs/${r.id}.pdf` : null,
        pdfName: r.pdfName,
        pdfSize: r.pdfSize,
      }));
    }),

  /** 编辑项目名与标签（需密码） */
  update: publicQuery
    .input(
      z.object({
        password: z.string(),
        id: z.string().max(32),
        label: z.string().min(1).max(255),
        tags: z.array(z.string().max(32)).max(8),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      await ensureProjectsStore();
      await updateProjectMeta(input.id, { label: input.label, tags: input.tags });
      return { ok: true };
    }),

  /** 新增项目（需密码），可指定分类 */
  create: publicQuery
    .input(
      z.object({
        password: z.string(),
        id: z.string().min(1).max(32).regex(/^[a-z0-9][a-z0-9_-]*$/, "仅支持小写字母、数字、连字符、下划线"),
        label: z.string().min(1).max(255),
        tags: z.array(z.string().max(32)).max(8).default([]),
        category: z.enum(["project", "research"]).default("project"),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      await ensureProjectsStore();
      await createProject({ id: input.id, label: input.label, tags: input.tags, category: input.category });
      return { ok: true };
    }),

  /** 批量更新排序（需密码，拖拽排序后调用） */
  reorder: publicQuery
    .input(
      z.object({
        password: z.string(),
        items: z.array(z.object({ id: z.string().max(32), sortOrder: z.number().int() })).max(100),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      await ensureProjectsStore();
      await reorderProjects(input.items);
      return { ok: true };
    }),

  /** 删除项目（需密码，同时删除其 PDF 文件） */
  remove: publicQuery
    .input(z.object({ password: z.string(), id: z.string().max(32) }))
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      await ensureProjectsStore();
      const removed = await deleteProject(input.id);
      // 删除条目时一并删除其 PDF 文件
      if (removed) {
        const { removePdf } = await import("./queries/pdfStore");
        await removePdf(input.id).catch(() => {});
      }
      return { ok: true };
    }),
});

export const articlesRouter = createRouter({
  /** 文章目录清单（前台侧边栏读取） */
  list: publicQuery.query(async () => {
    return listArticles();
  }),

  /** 同步状态（后台展示，含过程日志） */
  syncStatus: publicQuery.query(() => {
    const cred = credentialStatus();
    return { ...cred, lastSyncedAt: lastSyncedAt(), logs: getSyncLogs(), syncing: isSyncing() };
  }),

  /** 保存 Git 凭证（保留接口兼容旧前端；公开仓库 HTTPS 拉取已不需要凭证） */
  saveCredential: publicQuery
    .input(z.object({ password: z.string(), type: z.enum(["ssh", "token"]), value: z.string().min(1) }))
    .mutation(({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      saveCredential({ type: input.type, value: input.value });
      return { ok: true };
    }),

  /** 从仓库拉取最新文章（需密码） */
  sync: publicQuery
    .input(z.object({ password: z.string() }))
    .mutation(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) {
        throw new Error("密码错误");
      }
      return syncArticlesFromGit();
    }),
});

/** 线上文件诊断（后台"文件诊断"Tab）：查看服务器文件目录 + PDF 绑定关系 */
export const diagRouter = createRouter({
  /** 列出关键目录的文件树 */
  fileTree: publicQuery
    .input(z.object({ password: z.string(), dir: z.string().max(64).optional() }))
    .query(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) throw new Error("密码错误");
      const { listDirTree } = await import("./queries/pdfStore");
      // 白名单目录，防止任意路径探测
      const allowed = ["uploads", "uploads/pdfs", "uploads/articles", "assets", "assets/articles", "public"];
      const dir = input.dir && allowed.some((a) => input.dir === a || input.dir!.startsWith(a + "/")) ? input.dir : "uploads";
      return { dir, tree: await listDirTree(dir!, 3) };
    }),

  /** PDF 绑定关系：数据库 item ↔ 磁盘文件位置 */
  pdfBindings: publicQuery
    .input(z.object({ password: z.string() }))
    .query(async ({ input }) => {
      if (input.password !== ADMIN_PASSWORD) throw new Error("密码错误");
      const { pdfBindingRows, pdfDiagnostics } = await import("./queries/pdfStore");
      const [rows, diag] = await Promise.all([pdfBindingRows(), pdfDiagnostics()]);
      return { rows, cwd: diag.cwd, uploadDir: diag.uploadDir, assetsDir: diag.assetsDir, dbReachable: diag.dbReachable };
    }),
});

export const analyticsRouter = createRouter({
  daily: publicQuery.query(async () => {
    const rows = await getDb()
      .select({
        date: sql<string>`DATE_FORMAT(${visits.createdAt}, '%Y-%m-%d')`.as("date"),
        pv: sql<number>`COUNT(*)`.as("pv"),
        uv: sql<number>`COUNT(DISTINCT ${visits.fingerprint})`.as("uv"),
      })
      .from(visits)
      .groupBy(sql`DATE_FORMAT(${visits.createdAt}, '%Y-%m-%d')`)
      .orderBy(desc(sql`DATE_FORMAT(${visits.createdAt}, '%Y-%m-%d')`));
    return rows.map((r) => ({ date: r.date, pv: Number(r.pv), uv: Number(r.uv) }));
  }),

  dayDetail: publicQuery
    .input(z.object({ date: z.string() }))
    .query(async ({ input }) => {
      const rows = await getDb()
        .select({
          id: visits.id,
          createdAt: visits.createdAt,
          ip: visits.ip,
          path: visits.path,
          ua: visits.ua,
        })
        .from(visits)
        .where(sql`DATE_FORMAT(${visits.createdAt}, '%Y-%m-%d') = ${input.date}`)
        .orderBy(desc(visits.createdAt));
      return rows;
    }),
});
