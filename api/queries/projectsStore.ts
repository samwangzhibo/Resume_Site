import fsp from "node:fs/promises";
import { join } from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { projectMaterials } from "@db/schema";
import { scanPdfs } from "./pdfStore";

/**
 * 项目材料存储层：优先数据库（PDF 本体以 base64 存库，部署重置不丢失），
 * 数据库不可用时自动降级为本地 JSON + uploads/pdfs 磁盘文件（本地预览兜底）。
 */

export type MaterialCategory = "project" | "research";

export interface ProjectMeta {
  id: string;
  label: string;
  tags: string[];
  sortOrder: number;
  pdfName: string | null;
  /** 磁盘兜底模式下的 PDF 相对路径；数据库模式下恒为 null（内容在 pdfData 列） */
  pdfPath: string | null;
  pdfSize: number | null;
  category: MaterialCategory;
}

const STORE_DIR = join(process.cwd(), "uploads");
const STORE_FILE = join(STORE_DIR, "projects.json");

/** 检测数据库是否可用（缓存结果 30 秒，避免每次请求都等待超时） */
let dbAvailable: boolean | null = null;
let dbCheckedAt = 0;

async function isDbAvailable(): Promise<boolean> {
  const now = Date.now();
  if (dbAvailable !== null && now - dbCheckedAt < 30_000) return dbAvailable;
  try {
    await getDb().execute(sql`SELECT 1`);
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
  dbCheckedAt = now;
  return dbAvailable;
}

/** 标记数据库不可用（某次操作失败后立即降级，不再等待下一次超时） */
function markDbDown() {
  dbAvailable = false;
  dbCheckedAt = Date.now();
}

/* ------------------------------ 本地文件存储（兜底，并发安全） ------------------------------ */

/** 本地读-改-写串行队列：防止并发上传时交叉写导致文件被截断 */
let writeQueue: Promise<unknown> = Promise.resolve();

async function withLocalLock<T>(fn: () => Promise<T>): Promise<T> {
  const prev = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((r) => (release = r));
  await prev.catch(() => {});
  try {
    return await fn();
  } finally {
    release();
  }
}

async function readLocal(): Promise<ProjectMeta[]> {
  try {
    const raw = await fsp.readFile(STORE_FILE, "utf-8");
    if (!raw.trim()) return [];
    const list = JSON.parse(raw) as ProjectMeta[];
    return list.map((p) => ({ ...p, category: p.category ?? "project" }));
  } catch {
    return [];
  }
}

/** 原子写：先写临时文件再 rename，避免半写状态 */
async function writeLocalAtomic(list: ProjectMeta[]) {
  await fsp.mkdir(STORE_DIR, { recursive: true });
  const tmp = `${STORE_FILE}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(list, null, 2), "utf-8");
  await fsp.rename(tmp, STORE_FILE);
}

/** 读-改-写原子执行（持锁），并发上传互不覆盖；fn 返回 null 表示不改动 */
async function mutateLocal<T>(fn: (list: ProjectMeta[]) => { list: ProjectMeta[]; result: T } | null): Promise<T | null> {
  return withLocalLock(async () => {
    const list = await readLocal();
    const out = fn(list);
    if (!out) return null;
    await writeLocalAtomic(out.list);
    return out.result;
  });
}

/** 默认条目（数据库和本地文件都没有时作为初始数据；PDF 由 pdfStore 按 id 扫描关联） */
const DEFAULT_PROJECTS: Omit<ProjectMeta, "pdfPath" | "pdfSize">[] = [
  { id: "engineering", label: "直播工程体系演进", tags: ["架构演进", "工程体系", "全链路"], sortOrder: 0, pdfName: null, category: "project" },
  { id: "hongbao", label: "红包架构重构", tags: ["架构重构", "工程提效", "商业化"], sortOrder: 1, pdfName: null, category: "project" },
  { id: "lianping", label: "连屏技术体系演进", tags: ["架构演进", "插件化", "音视频"], sortOrder: 2, pdfName: null, category: "project" },
  { id: "ai", label: "本地 AI 人脸特效", tags: ["AI Native", "成本优化", "端侧推理"], sortOrder: 3, pdfName: null, category: "project" },
  { id: "research-ads", label: "广告商业化行业观察", tags: ["商业化", "广告", "行业调研"], sortOrder: 10, pdfName: null, category: "research" },
  { id: "research-llm", label: "大模型的下半场", tags: ["大模型", "Agent", "行业调研"], sortOrder: 11, pdfName: null, category: "research" },
];

let seeded = false;

/** 初始化：本地兜底元数据就位（PDF 本体由 pdfStore 按目录扫描关联） */
export async function ensureProjectsStore() {
  if (seeded) return;
  seeded = true;

  const local = await readLocal();
  if (local.length === 0) {
    let fromDb: ProjectMeta[] = [];
    if (await isDbAvailable()) {
      try {
        const rows = await getDb()
          .select({
            id: projectMaterials.id,
            label: projectMaterials.label,
            tags: projectMaterials.tags,
            sortOrder: projectMaterials.sortOrder,
            category: projectMaterials.category,
          })
          .from(projectMaterials)
          .orderBy(asc(projectMaterials.sortOrder));
        fromDb = rows.map((r) => ({
          id: r.id,
          label: r.label,
          tags: JSON.parse(r.tags || "[]"),
          sortOrder: r.sortOrder,
          pdfName: null,
          pdfPath: null,
          pdfSize: null,
          category: (r.category as MaterialCategory) ?? "project",
        }));
      } catch {
        markDbDown();
      }
    }
    const initial = fromDb.length > 0 ? fromDb : DEFAULT_PROJECTS.map((p) => ({ ...p, pdfPath: null, pdfSize: null }));
    await writeLocalAtomic(initial);
  }
}

/* ------------------------------ 数据库种子（默认条目元数据，PDF 不入库） ------------------------------ */

let dbSeeded = false;

/** 数据库可用时：表为空则种入默认条目元数据（含行业调研两个条目） */
export async function ensureDbSeed() {
  if (dbSeeded) return;
  dbSeeded = true;
  if (!(await isDbAvailable())) return;
  try {
    const db = getDb();
    const rows = await db.select({ id: projectMaterials.id }).from(projectMaterials);
    if (rows.length === 0) {
      for (const p of DEFAULT_PROJECTS) {
        await db
          .insert(projectMaterials)
          .values({
            id: p.id,
            label: p.label,
            tags: JSON.stringify(p.tags),
            sortOrder: p.sortOrder,
            category: p.category,
          } as typeof projectMaterials.$inferInsert)
          .catch(() => {});
      }
    }
  } catch {
    markDbDown();
  }
}

/* ------------------------------ 对外接口（自动降级） ------------------------------ */

/**
 * 数据库写成功后，立即把最新数据库状态镜像到本地兜底文件。
 * 否则下次数据库抖动时服务降级读旧本地文件，用户的修改会"丢失"。
 */
async function mirrorDbToLocal() {
  try {
    const rows = await getDb()
      .select({
        id: projectMaterials.id,
        label: projectMaterials.label,
        tags: projectMaterials.tags,
        sortOrder: projectMaterials.sortOrder,
        category: projectMaterials.category,
      })
      .from(projectMaterials)
      .orderBy(asc(projectMaterials.sortOrder));
    const list = rows.map((r) => ({
      id: r.id,
      label: r.label,
      tags: JSON.parse(r.tags || "[]"),
      sortOrder: r.sortOrder,
      pdfName: null,
      pdfPath: null,
      pdfSize: null,
      category: (r.category as MaterialCategory) ?? "project",
    }));
    await writeLocalAtomic(list).catch(() => {});
  } catch {
    /* 镜像失败不影响主流程 */
  }
}

/** 给条目列表叠加 PDF 信息（扫描目录，按 id 关联） */
async function attachPdfInfo(list: ProjectMeta[]): Promise<ProjectMeta[]> {
  const pdfs = await scanPdfs();
  return list.map((p) => {
    const pdf = pdfs.get(p.id);
    return pdf
      ? { ...p, pdfName: pdf.fileName, pdfSize: pdf.size }
      : { ...p, pdfName: null, pdfSize: null };
  });
}

export async function listProjects(): Promise<ProjectMeta[]> {
  if (await isDbAvailable()) {
    try {
      const rows = await getDb()
        .select({
          id: projectMaterials.id,
          label: projectMaterials.label,
          tags: projectMaterials.tags,
          sortOrder: projectMaterials.sortOrder,
          category: projectMaterials.category,
        })
        .from(projectMaterials)
        .orderBy(asc(projectMaterials.sortOrder));
      const list = rows.map((r) => ({
        id: r.id,
        label: r.label,
        tags: JSON.parse(r.tags || "[]"),
        sortOrder: r.sortOrder,
        pdfName: null,
        pdfPath: null,
        pdfSize: null,
        category: (r.category as MaterialCategory) ?? "project",
      }));
      await writeLocalAtomic(list).catch(() => {});
      return attachPdfInfo(list);
    } catch {
      markDbDown();
    }
  }
  // 本地兜底：容器清理/重部署后 uploads/projects.json 丢失时，从数据库重取一次
  let local = await readLocal();
  if (local.length === 0) {
    const rows = await getDb()
      .select({
        id: projectMaterials.id,
        label: projectMaterials.label,
        tags: projectMaterials.tags,
        sortOrder: projectMaterials.sortOrder,
        category: projectMaterials.category,
      })
      .from(projectMaterials)
      .orderBy(asc(projectMaterials.sortOrder))
      .catch(() => [] as never[]);
    if (rows.length > 0) {
      local = rows.map((r) => ({
        id: r.id,
        label: r.label,
        tags: JSON.parse(r.tags || "[]"),
        sortOrder: r.sortOrder,
        pdfName: null,
        pdfPath: null,
        pdfSize: null,
        category: (r.category as MaterialCategory) ?? "project",
      }));
      dbAvailable = true;
      dbCheckedAt = Date.now();
      await writeLocalAtomic(local).catch(() => {});
    }
  }
  if (local.length === 0) {
    local = DEFAULT_PROJECTS.map((p) => ({ ...p, pdfPath: null, pdfSize: null }));
  }
  return attachPdfInfo(local.sort((a, b) => a.sortOrder - b.sortOrder));
}

export async function getProject(id: string): Promise<ProjectMeta | null> {
  const list = await listProjects();
  return list.find((p) => p.id === id) ?? null;
}

export async function updateProjectMeta(id: string, patch: { label: string; tags: string[] }) {
  if (await isDbAvailable()) {
    try {
      // 持锁：避免并发写后全表镜像互相覆盖
      return await withLocalLock(async () => {
        await getDb()
          .update(projectMaterials)
          .set({ label: patch.label, tags: JSON.stringify(patch.tags) })
          .where(eq(projectMaterials.id, id));
        await mirrorDbToLocal();
      });
    } catch {
      markDbDown();
    }
  }
  await mutateLocal((list) => {
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    list[idx] = { ...list[idx], label: patch.label, tags: patch.tags };
    return { list, result: undefined };
  });
}

export async function createProject(input: { id: string; label: string; tags: string[]; category?: MaterialCategory }) {
  const category = input.category ?? "project";
  if (await isDbAvailable()) {
    try {
      const existing = await getDb().query.projectMaterials.findFirst({
        where: eq(projectMaterials.id, input.id),
      });
      if (existing) throw new Error("该 ID 已存在，请换一个");
      const [{ maxOrder }] = await getDb()
        .select({ maxOrder: sql<number>`COALESCE(MAX(${projectMaterials.sortOrder}), -1)` })
        .from(projectMaterials);
      await withLocalLock(async () => {
        await getDb().insert(projectMaterials).values({
          id: input.id,
          label: input.label,
          tags: JSON.stringify(input.tags),
          sortOrder: Number(maxOrder) + 1,
          category,
        } as typeof projectMaterials.$inferInsert);
        await mirrorDbToLocal();
      });
      return;
    } catch (err) {
      if (err instanceof Error && err.message.includes("已存在")) throw err;
      markDbDown();
    }
  }
  const created = await mutateLocal((list) => {
    if (list.some((p) => p.id === input.id)) return null;
    const maxOrder = list.reduce((m, p) => Math.max(m, p.sortOrder), -1);
    list.push({ ...input, category, sortOrder: maxOrder + 1, pdfName: null, pdfPath: null, pdfSize: null });
    return { list, result: true };
  });
  if (!created) throw new Error("该 ID 已存在，请换一个");
}

/** 批量更新排序（拖拽排序后调用） */
export async function reorderProjects(items: { id: string; sortOrder: number }[]) {
  if (await isDbAvailable()) {
    try {
      await withLocalLock(async () => {
        for (const item of items) {
          await getDb()
            .update(projectMaterials)
            .set({ sortOrder: item.sortOrder })
            .where(eq(projectMaterials.id, item.id));
        }
        await mirrorDbToLocal();
      });
      return;
    } catch {
      markDbDown();
    }
  }
  await mutateLocal((list) => {
    for (const item of items) {
      const idx = list.findIndex((p) => p.id === item.id);
      if (idx >= 0) list[idx] = { ...list[idx], sortOrder: item.sortOrder };
    }
    return { list, result: undefined };
  });
}

export async function deleteProject(id: string): Promise<ProjectMeta | null> {
  let removed: ProjectMeta | null = null;
  if (await isDbAvailable()) {
    try {
      removed = await getProject(id);
      await withLocalLock(async () => {
        await getDb().delete(projectMaterials).where(eq(projectMaterials.id, id));
        await mirrorDbToLocal();
      });
      return removed;
    } catch {
      markDbDown();
    }
  }
  return (await mutateLocal((list) => {
    const idx = list.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const r = list[idx];
    list.splice(idx, 1);
    return { list, result: r };
  })) ?? removed;
}
