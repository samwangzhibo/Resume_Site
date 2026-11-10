import fsp from "node:fs/promises";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { sql } from "drizzle-orm";
import { getDb } from "./connection";

/**
 * PDF 存储（四层兜底，抗容器清理/重部署）：
 * 1. uploads/pdfs/    运行时高速缓存（最先读，可被清理）
 * 2. pdf_blobs 表     用户后台上传的持久副本（base64，跨部署不丢，启动时恢复到磁盘）
 * 3. assets/pdfs/     部署快照自带的内置 PDF（可被清理）
 * 4. pdfData.json     内置 PDF 的 base64，随源码打包，永不丢（最终兜底）
 * 优先级：上传目录 > 数据库 > 资产目录 > 内置数据。关联规则：文件名（去 .pdf）= 条目 id。
 */

const ASSETS_DIR = join(process.cwd(), "assets", "pdfs");
const UPLOAD_DIR = join(process.cwd(), "uploads", "pdfs");

/* ================= 现场诊断日志（区分"文件被清理" vs "索引掉了"） =================
 * 每次 PDF 状态被读取/恢复时记录一条，含四层来源各自的有无，
 * 通过 /api/debug/pdf-logs 拉取分析线上到底发生了什么。 */

interface PdfLogEntry {
  ts: string;
  event: string;
  id?: string;
  detail?: string;
}
const pdfLogs: PdfLogEntry[] = [];
function plog(event: string, id?: string, detail?: string) {
  pdfLogs.push({ ts: new Date().toLocaleString("zh-CN", { hour12: false }), event, id, detail });
  if (pdfLogs.length > 500) pdfLogs.splice(0, pdfLogs.length - 500);
  console.log(`[pdfStore] ${event}${id ? " " + id : ""}${detail ? " | " + detail : ""}`);
}
export function getPdfLogs(): PdfLogEntry[] {
  return [...pdfLogs];
}

/** 单层来源有无的快照（用于日志） */
async function layerSnapshot(id: string) {
  const up = (await fileSize(join(UPLOAD_DIR, `${id}.pdf`))) !== null;
  const as = (await fileSize(join(ASSETS_DIR, `${id}.pdf`))) !== null;
  const db = (await dbPdfSize(id)) !== null;
  const emb = embeddedBuffer(id) !== null;
  return { up, as, db, emb };
}
function snapText(s: { up: boolean; as: boolean; db: boolean; emb: boolean }) {
  return `uploads=${s.up ? "有" : "无"} assets=${s.as ? "有" : "无"} db=${s.db ? "有" : "无"} 内置=${s.emb ? "有" : "无"}`;
}

/** 内置 PDF 的 base64 数据（懒加载；随源码 COPY 进容器，路径固定为 cwd/api/queries/pdfData.json） */
let embeddedPdfs: Record<string, string> | null = null;
function loadEmbedded(): Record<string, string> {
  if (embeddedPdfs) return embeddedPdfs;
  for (const p of [
    join(process.cwd(), "api", "queries", "pdfData.json"),
    join(process.cwd(), "pdfData.json"),
  ]) {
    try {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (parsed && typeof parsed === "object") {
        embeddedPdfs = parsed;
        return embeddedPdfs!;
      }
    } catch {}
  }
  embeddedPdfs = {};
  return embeddedPdfs;
}

/** 从内存解码内置 PDF */
function embeddedBuffer(id: string): Buffer | null {
  const data = loadEmbedded()[id];
  if (!data) return null;
  try {
    return Buffer.from(data, "base64");
  } catch {
    return null;
  }
}

/** 仅替换已清理署名/职级的旧内置版本，避免磁盘或数据库副本重新显示旧文案。 */
const LEGACY_BUNDLED_PDF_HASHES: Record<string, string> = {
  hongbao: "a8045ddf77003c01de0e3ad4eb52b8ccf5d73a843664178d8f8b187ba146a1d6",
  "research-ads": "b67ba4d9ff3a19db6d9fde093bbcb6cd117521e1849a6ac9158db9cee48576b0",
  "research-llm": "67f3f898a030845ad86699c5dbe61960228ffaf5acd274e0fd8126c0985d55f6",
};

function currentPdfContent(id: string, buf: Buffer): Buffer {
  const legacyHash = LEGACY_BUNDLED_PDF_HASHES[id];
  if (legacyHash && createHash("sha256").update(buf).digest("hex") === legacyHash) {
    return embeddedBuffer(id) ?? buf;
  }
  return buf;
}

/* ================= 数据库持久层（pdf_blobs 表） =================
 * 用户后台上传的 PDF 同步写入数据库，跨部署/容器清理不丢；
 * 启动时从数据库恢复到 uploads/ 目录。数据库不可用时熔断降级为纯磁盘。 */

let dbDownUntil = 0;
function dbOk() {
  return Date.now() >= dbDownUntil;
}
function dbFail() {
  dbDownUntil = Date.now() + 60_000; // 熔断 60s，避免每次请求都等连接超时
}

/** drizzle execute 的返回形态做兼容处理，统一取出行数组 */
function rowsOf(res: unknown): Record<string, unknown>[] {
  const r = res as unknown[];
  if (Array.isArray(r) && Array.isArray(r[0])) return r[0] as Record<string, unknown>[];
  return (res as Record<string, unknown>[]) || [];
}

async function dbSavePdf(id: string, buf: Buffer): Promise<boolean> {
  if (!dbOk()) return false;
  try {
    await getDb().execute(
      sql`INSERT INTO pdf_blobs (id, data, size) VALUES (${id}, ${buf.toString("base64")}, ${buf.length})
          ON DUPLICATE KEY UPDATE data = VALUES(data), size = VALUES(size)`
    );
    return true;
  } catch (err) {
    console.warn("[pdfStore] dbSavePdf failed:", (err as Error)?.message || err);
    dbFail();
    return false;
  }
}

async function dbReadPdf(id: string): Promise<Buffer | null> {
  if (!dbOk()) return null;
  try {
    const rows = rowsOf(await getDb().execute(sql`SELECT data FROM pdf_blobs WHERE id = ${id} LIMIT 1`));
    const data = rows[0]?.data;
    if (!data) return null;
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(String(data), "base64");
    return buf.length > 4 ? buf : null;
  } catch {
    dbFail();
    return null;
  }
}

async function dbPdfSize(id: string): Promise<number | null> {
  if (!dbOk()) return null;
  try {
    const rows = rowsOf(await getDb().execute(sql`SELECT size FROM pdf_blobs WHERE id = ${id} LIMIT 1`));
    const size = Number(rows[0]?.size);
    return Number.isFinite(size) && size > 0 ? size : null;
  } catch {
    dbFail();
    return null;
  }
}

async function dbListPdfs(): Promise<{ id: string; size: number }[]> {
  if (!dbOk()) return [];
  try {
    const rows = rowsOf(await getDb().execute(sql`SELECT id, size FROM pdf_blobs`));
    return rows
      .map((r) => ({ id: String(r.id), size: Number(r.size) }))
      .filter((r) => safeId(r.id) && r.size > 0);
  } catch {
    dbFail();
    return [];
  }
}

async function dbDeletePdf(id: string): Promise<void> {
  if (!dbOk()) return;
  try {
    await getDb().execute(sql`DELETE FROM pdf_blobs WHERE id = ${id}`);
  } catch {
    dbFail();
  }
}

/** 条目 id 只允许安全字符，防止路径穿越 */
const SAFE_ID = /^[a-z0-9][a-z0-9-_]{0,60}$/i;

function safeId(id: string): string | null {
  return SAFE_ID.test(id) ? id : null;
}

export interface PdfRecord {
  fileName: string;
  size: number;
}

async function fileSize(abs: string): Promise<number | null> {
  try {
    const st = await fsp.stat(abs);
    return st.size;
  } catch {
    return null;
  }
}

/** 查询某条目的 PDF：上传目录 → 数据库 → 资产目录 → 内置数据。fileName 为原始文件名 */
export async function getPdf(id: string): Promise<PdfRecord | null> {
  const sid = safeId(id);
  if (!sid) return null;
  const name = ORIGINAL_NAMES[sid] || `${sid}.pdf`;
  const upSize = await fileSize(join(UPLOAD_DIR, `${sid}.pdf`));
  if (upSize !== null) return { fileName: name, size: upSize };
  const dbSize = await dbPdfSize(sid);
  if (dbSize !== null) return { fileName: name, size: dbSize };
  const asSize = await fileSize(join(ASSETS_DIR, `${sid}.pdf`));
  if (asSize !== null) return { fileName: name, size: asSize };
  // 目录被平台清理后，从内置数据兜底
  const buf = embeddedBuffer(sid);
  if (buf && buf.length > 4) return { fileName: name, size: buf.length };
  return null;
}

/** 内置 PDF 的原始展示文件名（按 id 映射，供下载时命名） */
const ORIGINAL_NAMES: Record<string, string> = {
  hongbao: "红包业务重构.pdf",
  ai: "本地AI.pdf",
  lianping: "直播连屏业务领域建设_v1.pdf",
  "research-ads": "从卖流量到卖决策 · 广告商业化行业观察.pdf",
  "research-llm": "大模型的下半场 · 客户端能做什么.pdf",
};

/** 单条目重建锁：防止并发请求对同一 id 重复/竞争重建 */
const rebuildLocks = new Map<string, Promise<boolean>>();
function withRebuildLock<T extends boolean>(sid: string, fn: () => Promise<T>): Promise<boolean> {
  const existing = rebuildLocks.get(sid);
  if (existing) return existing;
  const p = (async () => {
    try {
      return await fn();
    } finally {
      rebuildLocks.delete(sid);
    }
  })();
  rebuildLocks.set(sid, p);
  return p;
}

/** 自检并重建某条目到 uploads 高速缓存（若磁盘缺失但其它层有，则重建绑定），返回是否最终可用 */
async function ensureRebuilt(sid: string): Promise<boolean> {
  return withRebuildLock(sid, async () => {
    // 磁盘已有，无需重建
    if ((await fileSize(join(UPLOAD_DIR, `${sid}.pdf`))) !== null) return true;
    // 磁盘缺失 → 诊断是文件没了还是单纯索引/缓存掉了，并尝试从持久层重建
    const snap = await layerSnapshot(sid);
    if (!snap.db && !snap.as && !snap.emb) {
      plog("诊断:四层全部缺失，无法恢复", sid, snapText(snap));
      return false;
    }
    plog("磁盘缓存缺失，开始重建", sid, snapText(snap));
    // 优先级：数据库 > 资产 > 内置
    let buf: Buffer | null = null;
    let from = "";
    if (snap.db) { buf = await dbReadPdf(sid); from = "数据库"; }
    if (!buf && snap.as) { try { buf = await fsp.readFile(join(ASSETS_DIR, `${sid}.pdf`)); from = "资产目录"; } catch {} }
    if (!buf && snap.emb) { buf = embeddedBuffer(sid); from = "内置数据"; }
    if (!buf) {
      plog("重建失败:持久层读出为空", sid, snapText(snap));
      return false;
    }
    try {
      await fsp.mkdir(UPLOAD_DIR, { recursive: true });
      const tmp = join(UPLOAD_DIR, `${sid}.pdf.tmp`);
      await fsp.writeFile(tmp, buf);
      await fsp.rename(tmp, join(UPLOAD_DIR, `${sid}.pdf`));
      plog(`重建成功:从${from}恢复到 uploads`, sid, `${buf.length}字节`);
      return true;
    } catch (err) {
      plog("重建失败:写盘出错", sid, (err as Error)?.message || String(err));
      return false;
    }
  });
}

/** 读取 PDF 内容（公开下载用）：上传目录 → 自检重建 → 数据库 → 资产目录 → 内置数据 */
export async function readPdf(id: string): Promise<Buffer | null> {
  const sid = safeId(id);
  if (!sid) return null;
  try {
    return currentPdfContent(sid, await fsp.readFile(join(UPLOAD_DIR, `${sid}.pdf`)));
  } catch {}
  // 磁盘缺失：先尝试从持久层重建到磁盘（并记录日志）
  await ensureRebuilt(sid);
  try {
    return currentPdfContent(sid, await fsp.readFile(join(UPLOAD_DIR, `${sid}.pdf`)));
  } catch {}
  // 数据库优先于资产目录：用户上传的替换版本存在数据库里
  const dbBuf = await dbReadPdf(sid);
  if (dbBuf) return currentPdfContent(sid, dbBuf);
  try {
    return currentPdfContent(sid, await fsp.readFile(join(ASSETS_DIR, `${sid}.pdf`)));
  } catch {}
  // 目录被平台清理后，从内置数据兜底
  const emb = embeddedBuffer(sid);
  if (!emb) plog("读取最终失败:四层均无此PDF", sid, snapText(await layerSnapshot(sid)));
  return emb;
}

/** 写入 PDF：磁盘（快）+ 数据库（持久，跨部署不丢）。返回磁盘写入是否成功 */
export async function writePdf(id: string, buf: Buffer): Promise<boolean> {
  const sid = safeId(id);
  if (!sid) return false;
  try {
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const tmp = join(UPLOAD_DIR, `${sid}.pdf.tmp`);
    await fsp.writeFile(tmp, buf);
    await fsp.rename(tmp, join(UPLOAD_DIR, `${sid}.pdf`));
  } catch (err) {
    plog("上传失败:写盘出错", sid, (err as Error)?.message || String(err));
    return false;
  }
  const persisted = await dbSavePdf(sid, buf);
  if (persisted) {
    plog("上传成功:已写盘+入库", sid, `${buf.length}字节`);
  } else {
    plog("上传成功但入库失败(重部署后需重传)", sid, `${buf.length}字节`);
  }
  return true;
}

/** 删除上传目录与数据库中的 PDF；资产目录/内置数据中的内置 PDF 会作为兜底重新出现 */
export async function removePdf(id: string): Promise<boolean> {
  const sid = safeId(id);
  if (!sid) return false;
  await dbDeletePdf(sid);
  try {
    await fsp.unlink(join(UPLOAD_DIR, `${sid}.pdf`));
    return true;
  } catch {
    return false;
  }
}

/** 扫描全部来源，返回 id → PDF 记录。优先级：上传目录 > 数据库 > 资产目录 > 内置数据。
 *  扫描前先对已知条目做自检重建（磁盘掉了从持久层恢复），并记录现场日志。 */
export async function scanPdfs(): Promise<Map<string, PdfRecord>> {
  const map = new Map<string, PdfRecord>();
  async function scanDir(dir: string, overwrite: boolean) {
    try {
      const names = await fsp.readdir(dir);
      for (const name of names) {
        if (extname(name).toLowerCase() !== ".pdf") continue;
        const id = name.slice(0, -4);
        if (!safeId(id)) continue;
        if (!overwrite && map.has(id)) continue;
        const size = await fileSize(join(dir, name));
        if (size !== null) map.set(id, { fileName: name, size });
      }
    } catch {}
  }

  // 先收集所有"应该有 PDF"的条目 id（数据库 + 资产 + 内置 + 上传目录）
  const knownIds = new Set<string>([
    ...Object.keys(loadEmbedded()),
    ...(await dbListPdfs()).map((r) => r.id),
  ]);
  for (const dir of [ASSETS_DIR, UPLOAD_DIR]) {
    try {
      for (const name of await fsp.readdir(dir)) {
        if (extname(name).toLowerCase() === ".pdf") {
          const id = name.slice(0, -4);
          if (safeId(id)) knownIds.add(id);
        }
      }
    } catch {}
  }

  // 自检重建：凡磁盘缺失但持久层有的，恢复到 uploads 并记日志（并发执行，条目间互不等待）
  await Promise.all([...knownIds].filter((id) => safeId(id)).map((id) => ensureRebuilt(id)));

  await scanDir(ASSETS_DIR, true); // 资产（兜底）
  // 内置数据补充：目录被清理后仍能看到内置 PDF
  for (const id of Object.keys(loadEmbedded())) {
    if (map.has(id) || !safeId(id)) continue;
    const buf = embeddedBuffer(id);
    if (buf) map.set(id, { fileName: ORIGINAL_NAMES[id] || `${id}.pdf`, size: buf.length });
  }
  // 数据库（用户上传的持久副本，覆盖内置版本）
  for (const row of await dbListPdfs()) {
    map.set(row.id, { fileName: ORIGINAL_NAMES[row.id] || `${row.id}.pdf`, size: row.size });
  }
  await scanDir(UPLOAD_DIR, true); // 上传目录最新，最后覆盖
  return map;
}

/** 诊断：返回两个目录的实际状态 + 各条目四层来源快照（调试用，公开只读） */
export async function pdfDiagnostics(): Promise<{
  cwd: string;
  assetsDir: string;
  uploadDir: string;
  assets: string[];
  uploads: string[];
  embedded: string[];
  database: string[];
  layers: Record<string, string>;
  dbReachable: boolean;
}> {
  async function ls(dir: string): Promise<string[]> {
    try {
      return await fsp.readdir(dir);
    } catch {
      return [];
    }
  }
  const knownIds = new Set<string>([
    ...Object.keys(loadEmbedded()),
    ...(await dbListPdfs()).map((r) => r.id),
    ...(await ls(ASSETS_DIR)).filter((n) => n.endsWith(".pdf")).map((n) => n.slice(0, -4)),
    ...(await ls(UPLOAD_DIR)).filter((n) => n.endsWith(".pdf")).map((n) => n.slice(0, -4)),
  ]);
  const layers: Record<string, string> = {};
  for (const id of knownIds) {
    if (safeId(id)) layers[id] = snapText(await layerSnapshot(id));
  }
  return {
    cwd: process.cwd(),
    assetsDir: ASSETS_DIR,
    uploadDir: UPLOAD_DIR,
    assets: await ls(ASSETS_DIR),
    uploads: await ls(UPLOAD_DIR),
    embedded: Object.keys(loadEmbedded()),
    database: (await dbListPdfs()).map((r) => `${r.id}(${r.size})`),
    layers,
    dbReachable: dbOk(),
  };
}

/** 启动时：把资产目录/内置数据/数据库的 PDF 强制写入上传目录，保证部署快照中的 PDF 直接生效 */
export async function seedPdfsFromAssets(): Promise<void> {
  plog("服务启动:开始种子恢复 PDF", undefined, `db可达=${dbOk()}`);
  try {
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const seen = new Set<string>();
    if (existsSync(ASSETS_DIR)) {
      for (const name of readdirSync(ASSETS_DIR)) {
        if (extname(name).toLowerCase() !== ".pdf") continue;
        try {
          await fsp.copyFile(join(ASSETS_DIR, name), join(UPLOAD_DIR, name));
          seen.add(name.slice(0, -4));
        } catch {}
      }
    }
    // 资产目录缺失的条目，从内置 base64 数据写入
    for (const id of Object.keys(loadEmbedded())) {
      if (seen.has(id) || !safeId(id)) continue;
      const buf = embeddedBuffer(id);
      if (!buf) continue;
      try {
        const tmp = join(UPLOAD_DIR, `${id}.pdf.tmp`);
        await fsp.writeFile(tmp, buf);
        await fsp.rename(tmp, join(UPLOAD_DIR, `${id}.pdf`));
      } catch {}
    }
    // 最后从数据库恢复用户上传的 PDF（优先级最高，覆盖内置版本）
    const dbRows = await dbListPdfs();
    for (const row of dbRows) {
      const buf = await dbReadPdf(row.id);
      if (!buf) continue;
      try {
        const tmp = join(UPLOAD_DIR, `${row.id}.pdf.tmp`);
        await fsp.writeFile(tmp, buf);
        await fsp.rename(tmp, join(UPLOAD_DIR, `${row.id}.pdf`));
      } catch {}
    }
    const finalList = await fsp.readdir(UPLOAD_DIR).catch(() => [] as string[]);
    plog("种子恢复完成", undefined, `uploads目录现有 ${finalList.filter((n) => n.endsWith(".pdf")).length} 个PDF（资产${seen.size} 内置${Object.keys(loadEmbedded()).length} 数据库${dbRows.length}）`);
  } catch (err) {
    plog("种子恢复异常", undefined, (err as Error)?.message || String(err));
  }
}

/* ================= 线上文件诊断（后台"文件诊断"Tab） ================= */

export interface FileNode {
  name: string;
  type: "dir" | "file";
  size?: number;
  children?: FileNode[];
}

/** 递归列目录（限深度/条目数，忽略 . 开头与 node_modules），供后台查看线上文件结构 */
export async function listDirTree(relDir: string, maxDepth = 3): Promise<FileNode[]> {
  const root = join(process.cwd(), relDir);
  async function walk(dir: string, depth: number): Promise<FileNode[]> {
    if (depth > maxDepth) return [];
    let items;
    try {
      items = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const nodes: FileNode[] = [];
    for (const item of items) {
      if (item.name.startsWith(".") || item.name === "node_modules") continue;
      const abs = join(dir, item.name);
      if (item.isDirectory()) {
        nodes.push({ name: item.name, type: "dir", children: await walk(abs, depth + 1) });
      } else {
        let size = 0;
        try { size = (await fsp.stat(abs)).size; } catch {}
        nodes.push({ name: item.name, type: "file", size });
      }
    }
    // 目录在前，文件在后，各自按名排序
    nodes.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, "zh-CN") : a.type === "dir" ? -1 : 1));
    return nodes.slice(0, 200); // 每层最多 200 项
  }
  return walk(root, 1);
}

/** pdf_blobs 表里的 item 与磁盘 PDF 的对应关系（供后台核对绑定） */
export async function pdfBindingRows(): Promise<
  { id: string; dbSize: number | null; uploadsSize: number | null; assetsSize: number | null; embedded: boolean; status: string }[]
> {
  const ids = new Set<string>([
    ...Object.keys(loadEmbedded()),
    ...(await dbListPdfs()).map((r) => r.id),
  ]);
  for (const dir of [UPLOAD_DIR, ASSETS_DIR]) {
    try {
      for (const n of await fsp.readdir(dir)) {
        if (n.endsWith(".pdf")) {
          const id = n.slice(0, -4);
          if (safeId(id)) ids.add(id);
        }
      }
    } catch {}
  }
  const rows = [];
  for (const id of [...ids].sort()) {
    if (!safeId(id)) continue;
    const dbSize = await dbPdfSize(id);
    const uploadsSize = await fileSize(join(UPLOAD_DIR, `${id}.pdf`));
    const assetsSize = await fileSize(join(ASSETS_DIR, `${id}.pdf`));
    const embedded = embeddedBuffer(id) !== null;
    let status = "正常";
    if (uploadsSize !== null) status = "正常(磁盘)";
    else if (dbSize !== null) status = "磁盘缺失·库里有(待重建)";
    else if (assetsSize !== null) status = "磁盘缺失·资产里有(待重建)";
    else if (embedded) status = "磁盘缺失·仅内置(待重建)";
    else status = "异常:四层均无";
    rows.push({ id, dbSize, uploadsSize, assetsSize, embedded, status });
  }
  return rows;
}
