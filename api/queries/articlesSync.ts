import fsp from "node:fs/promises";
import { existsSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync, createWriteStream, statSync } from "node:fs";

/** 递归删除（带重试：并发/网络文件系统下偶发 ENOTEMPTY 竞态） */
function rmrf(path: string) {
  rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { join, relative, extname } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * 技术文章同步：从 Git 仓库拉取最新文章（含图片），
 * 同步到 uploads/articles/，并重建目录清单 manifest。
 * 优先数据库凭证，其次本地文件凭证（与项目材料同一兜底策略）。
 */

const ARTICLES_DIR = join(process.cwd(), "uploads", "articles");
const CREDENTIAL_FILE = join(process.cwd(), "uploads", "git-credential.json");
/** 公开仓库固定走 HTTPS 拉取，无需任何凭证 */
const REPO_HTTPS_URL = "https://github.com/samwangzhibo/Result_Resume_Wiki.git";

/** 文章清单需整体屏蔽的目录（大小写不敏感）。WorkBuddyRaw 为 AI 生成素材目录，不入库、不展示 */
const EXCLUDED_DIRS = new Set(["workbuddyraw"]);
/** 文章清单需屏蔽的说明文件（README 等，大小写不敏感） */
const EXCLUDED_FILE_RE = /^readme(\.(md|txt|markdown))?$/i;

/** 复制/扫描时统一判断：是否应排除某个路径段 */
function shouldExcludeSegment(seg: string): boolean {
  return seg.startsWith(".") || EXCLUDED_DIRS.has(seg.toLowerCase()) || EXCLUDED_FILE_RE.test(seg);
}

/** 同步过程的详细日志（带时间戳，供后台界面展示） */
const syncLogs: string[] = [];
function log(msg: string) {
  const line = `[${new Date().toLocaleString("zh-CN", { hour12: false })}] ${msg}`;
  syncLogs.push(line);
  if (syncLogs.length > 200) syncLogs.splice(0, syncLogs.length - 200);
  console.log(`[articles] ${msg}`);
}
export function getSyncLogs(): string[] {
  return [...syncLogs];
}

export interface GitCredential {
  type: "ssh" | "token";
  /** ssh 模式为私钥内容，token 模式为 GitHub Personal Access Token */
  value: string;
}

/* ------------------------------ 凭证管理 ------------------------------ */

export function saveCredential(cred: GitCredential) {
  mkdirSync(join(process.cwd(), "uploads"), { recursive: true });
  writeFileSync(CREDENTIAL_FILE, JSON.stringify(cred), "utf-8");
}

export function readCredential(): GitCredential | null {
  try {
    return JSON.parse(readFileSync(CREDENTIAL_FILE, "utf-8")) as GitCredential;
  } catch {
    return null;
  }
}

export function credentialStatus(): { configured: boolean; type: string | null } {
  const cred = readCredential();
  return { configured: !!cred?.value, type: cred?.type ?? null };
}

/* ------------------------------ 文章目录初始化 ------------------------------ */

let articlesSeeded = false;

/** 递归统计目录下实际存在的 md 文件数（忽略 . 开头） */
async function countMdFiles(dir: string): Promise<number> {
  let count = 0;
  try {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".")) continue;
      const abs = join(dir, item.name);
      if (item.isDirectory()) count += await countMdFiles(abs);
      else if (item.name.toLowerCase().endsWith(".md")) count++;
    }
  } catch { /* 目录不存在等 */ }
  return count;
}

/** 首次启动：uploads/articles 不存在/为空/manifest 与实际文件不符时，从打包资产（assets/articles，部署快照自带最新文章）复制 */
export async function ensureArticlesStore() {
  if (articlesSeeded) return;
  articlesSeeded = true;
  const manifestPath = join(ARTICLES_DIR, "manifest.json");
  if (existsSync(manifestPath)) {
    // 空 manifest 视为无效，继续用资产兜底（否则同步中断后文章会显示为空）
    try {
      const raw = JSON.parse(readFileSync(manifestPath, "utf-8")) as unknown[];
      if (Array.isArray(raw) && raw.length > 0) {
        // 再校验实际 md 文件：目录被外部清理、只剩 manifest 残壳时也必须兜底恢复
        const mdCount = await countMdFiles(ARTICLES_DIR);
        if (mdCount > 0) return;
        log(`manifest 记录 ${raw.length} 篇但目录下 md 文件为 0（目录疑似被清理），从资产恢复`);
      }
    } catch { /* 继续重建 */ }
  }
  mkdirSync(ARTICLES_DIR, { recursive: true });
  for (const dir of ["assets/articles", "dist/public/articles", "public/articles"]) {
    const src = join(process.cwd(), dir);
    if (existsSync(src)) {
      cpSync(src, ARTICLES_DIR, {
        recursive: true,
        filter: (s) => !relative(src, s).split("/").some((seg) => shouldExcludeSegment(seg)),
      });
      break;
    }
  }
  await rebuildManifest();
}

/* ------------------------------ 目录清单 ------------------------------ */

export interface ArticleEntry {
  /** 顶层目录名（分组名） */
  dir: string;
  /** 文件名 */
  file: string;
  /** 文章标题 = md 文件名（去 .md 后缀、去 [高] 类优先级前缀） */
  title: string;
  path: string;
}

/** 从 md 文件名生成展示标题：去 .md 后缀，去 [高]/[中]/[低] 类前缀 */
function mdTitle(fileName: string): string {
  return fileName.replace(/\.md$/i, "").replace(/^\s*\[[^\]]{1,6}\]\s*/, "");
}

/** 扫描 uploads/articles 下的 md 文件（按顶层目录分组），重建 manifest.json */
async function rebuildManifest(): Promise<ArticleEntry[]> {
  const entries: ArticleEntry[] = [];
  async function scan(dir: string, group: string) {
    const items = await fsp.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      // 忽略 . 开头文件、WorkBuddyRaw 素材目录、README 等说明文件
      if (shouldExcludeSegment(item.name)) continue;
      const abs = join(dir, item.name);
      if (item.isDirectory()) {
        await scan(abs, group ? `${group}/${item.name}` : item.name);
      } else if (item.name.toLowerCase().endsWith(".md") && group) {
        const rel = relative(ARTICLES_DIR, abs).split("\\").join("/");
        entries.push({
          dir: group.split("/")[0],
          file: item.name,
          title: mdTitle(item.name),
          path: `/api/articles/file?p=${encodeURIComponent(rel)}`,
        });
      }
    }
  }
  await scan(ARTICLES_DIR, "");
  entries.sort((a, b) => a.dir.localeCompare(b.dir, "zh-CN"));
  writeFileSync(join(ARTICLES_DIR, "manifest.json"), JSON.stringify(entries, null, 2), "utf-8");
  // 同步写一份到静态 articles.json（兼容旧读取路径）
  writeFileSync(join(ARTICLES_DIR, "articles.json"), JSON.stringify(entries, null, 2), "utf-8");
  return entries;
}

export async function listArticles(): Promise<ArticleEntry[]> {
  await ensureArticlesStore();
  try {
    const raw = JSON.parse(await fsp.readFile(join(ARTICLES_DIR, "manifest.json"), "utf-8")) as ArticleEntry[];
    // 兼容旧 manifest：缺 title 字段则重建
    if (raw.length > 0 && !raw[0].title) return rebuildManifest();
    return raw;
  } catch {
    return rebuildManifest();
  }
}

/** 按相对路径安全读取文章/图片文件（防路径穿越） */
export async function readArticleFile(relPath: string): Promise<{ buf: Buffer; contentType: string } | null> {
  await ensureArticlesStore();
  const rel = decodeURIComponent(relPath).split("\\").join("/").replace(/^\/+/, "");
  const abs = join(ARTICLES_DIR, rel);
  if (!abs.startsWith(ARTICLES_DIR)) return null;
  // 屏蔽路径段（WorkBuddyRaw、README 等）一律拒绝访问，防止绕过清单直接下载敏感文件
  if (rel.split("/").some((seg) => shouldExcludeSegment(seg))) return null;
  try {
    const buf = await fsp.readFile(abs);
    const ext = extname(abs).toLowerCase();
    const contentType =
      ext === ".md"
        ? "text/markdown; charset=utf-8"
        : ext === ".svg"
          ? "image/svg+xml"
          : ext === ".png"
            ? "image/png"
            : ext === ".jpg" || ext === ".jpeg"
              ? "image/jpeg"
              : ext === ".gif"
                ? "image/gif"
                : ext === ".webp"
                  ? "image/webp"
                  : "application/octet-stream";
    return { buf, contentType };
  } catch {
    return null;
  }
}

/* ------------------------------ 仓库同步 ------------------------------ */

export interface SyncResult {
  ok: boolean;
  message: string;
  count?: number;
  syncedAt?: string;
  /** 本次同步的详细日志行 */
  logs?: string[];
  /** 因已有同步任务在执行而未被受理（非失败，前端可提示"进行中"） */
  busy?: boolean;
}

/** 本地仓库缓存目录：存在有效 git 仓库时走增量更新，避免每次全量克隆 200MB */
const REPO_CACHE_DIR = join(process.cwd(), "uploads", ".repo-cache");
/** 备用通道 tar.gz 解压目录：独立于 .repo-cache，避免破坏 git 缓存（否则下次只能全量克隆） */
const REPO_TARBALL_DIR = join(process.cwd(), "uploads", ".repo-tarball");

/** 本地是否已有可复用的 git 仓库 */
function hasLocalRepo(dir: string): boolean {
  return existsSync(join(dir, ".git"));
}

/**
 * 校验本地 git 仓库结构是否完好：.git 存在但半拉/损坏（上次中断的 clone）时返回 false，
 * 用于区分"缓存损坏（应清理重克隆）"与"仓库完好只是网络拉取失败（必须保留缓存）"。
 */
async function isRepoUsable(dir: string): Promise<boolean> {
  try {
    await execFileAsync("git", ["-C", dir, "rev-parse", "--git-dir"], { timeout: 30_000 });
    await execFileAsync("git", ["-C", dir, "rev-parse", "--verify", "HEAD"], { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

/** 读取仓库当前分支名（detached / 读取失败返回 null） */
async function currentBranch(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", dir, "rev-parse", "--abbrev-ref", "HEAD"], { timeout: 30_000 });
    const branch = stdout.trim();
    return branch && branch !== "HEAD" ? branch : null;
  } catch {
    return null;
  }
}

/** 从 git 错误里挑出 fatal/error 关键行，作为用户可读 message（避免被进度刷屏污染） */
function pickGitError(err: unknown): string {
  const e = err as Error & { stderr?: string };
  const raw = [e?.stderr, e?.message].filter(Boolean).join(" | ");
  const keyLine = (e?.stderr || "")
    .split(/\r|\n/)
    .map((l) => l.trim())
    .filter((l) => /^(fatal|error):/i.test(l))
    .slice(-2)
    .join("；");
  return keyLine || raw.slice(0, 200);
}

/** 执行 git 命令：强制 HTTP/1.1（线上对 GitHub 的 HTTP/2 帧层不稳定），逐行收集 stderr 到同步日志 */
async function runGit(args: string[], label: string): Promise<void> {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  const startedAt = Date.now();
  log(`${label}...`);
  await new Promise<void>((resolve, reject) => {
    const child = execFile(
      "git",
      ["-c", "http.version=HTTP/1.1", "-c", "http.postBuffer=524288000", ...args],
      { env, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
    );
    let stderrTail = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrTail = (stderrTail + text).slice(-2000);
      for (const line of text.split(/\r|\n/)) {
        const t = line.trim();
        if (!t) continue;
        // 跳过高频进度刷屏行，保留 fatal/error/done 等关键信息
        if (/^(remote: )?(Enumerating|Counting|Compressing|Receiving|Resolving|Total|Updating)/.test(t)) continue;
        log(`git: ${t.slice(0, 200)}`);
      }
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(Object.assign(new Error(`git exit ${code}`), { stderr: stderrTail })),
    );
  });
  log(`${label}完成，耗时 ${Math.round((Date.now() - startedAt) / 1000)}s`);
}

/**
 * 增量更新本地仓库：优先 git pull --rebase（本地无改动时等价于快进）。
 * 浅克隆仓库与新提交没有共同 merge base，rebase 可能失败，此时退回
 * fetch --depth 1 + reset --hard FETCH_HEAD（语义等价，且不依赖 merge base）。
 */
async function updateLocalRepo(dir: string): Promise<void> {
  const detected = await currentBranch(dir);
  const branches = detected ? [detected] : ["main", "master"];
  let lastErr: unknown = null;
  for (const branch of branches) {
    try {
      await runGit(["-C", dir, "pull", "--rebase", "--autostash", "--depth", "1", "origin", branch], `增量更新仓库（pull --rebase ${branch}）`);
      return;
    } catch (err) {
      lastErr = err;
      log(`pull --rebase（${branch}）不可用，改用 fetch + reset --hard`);
    }
    // 清理可能残留的 rebase 中间状态（无 rebase 进行中时该命令失败，忽略即可）
    try { await execFileAsync("git", ["-C", dir, "rebase", "--abort"], { timeout: 30_000 }); } catch { /* 忽略 */ }
    try {
      await runGit(["-C", dir, "fetch", "--depth", "1", "origin", branch], `增量拉取仓库（fetch --depth 1 ${branch}）`);
      await runGit(["-C", dir, "reset", "--hard", "FETCH_HEAD"], "重置工作区到远端最新提交");
      return;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/**
 * 备用通道：直接下载仓库 tar.gz 压缩包并解压到独立目录 REPO_TARBALL_DIR。
 * 与 git 智能 HTTP 协议走不同端点（codeload.github.com），
 * 线上平台对 github.com git 协议不稳定（HTTP/2 帧层错误 / Empty reply）时可绕过。
 * 注意：解压到独立目录而非 .repo-cache，避免毁掉 .git 缓存导致下次退化为全量克隆。
 */
async function downloadRepoTarball(): Promise<boolean> {
  const tgzPath = join(process.cwd(), "uploads", ".repo-tmp.tar.gz");
  for (const branch of ["main", "master"]) {
    const url = `https://codeload.github.com/samwangzhibo/Result_Resume_Wiki/tar.gz/refs/heads/${branch}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 300_000);
    try {
      log(`备用通道：正在下载压缩包（${branch} 分支）...`);
      const startedAt = Date.now();
      const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
      if (!res.ok || !res.body) {
        log(`备用通道：${branch} 分支下载失败（HTTP ${res.status}）`);
        continue;
      }
      // 流式落盘，避免大文件占内存
      await pipeline(Readable.fromWeb(res.body as unknown as Parameters<typeof Readable.fromWeb>[0]), createWriteStream(tgzPath));
      const sizeMb = (statSync(tgzPath).size / 1024 / 1024).toFixed(1);
      log(`备用通道：压缩包下载完成（${sizeMb}MB，耗时 ${Math.round((Date.now() - startedAt) / 1000)}s），正在解压...`);

      try { rmrf(REPO_TARBALL_DIR); } catch { /* 忽略 */ }
      mkdirSync(REPO_TARBALL_DIR, { recursive: true });
      // tar.gz 解压并剥掉顶层目录（repo-branch/），内容直接落到解压目录
      await execFileAsync("tar", ["-xzf", tgzPath, "-C", REPO_TARBALL_DIR, "--strip-components=1"], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
      log("备用通道：解压完成");
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log(`备用通道失败（${branch}）：${msg.slice(0, 200)}`);
    } finally {
      clearTimeout(timer);
      try { rmSync(tgzPath, { force: true }); } catch { /* 忽略 */ }
    }
  }
  return false;
}

/** 同步互斥：同一时刻只允许一个同步任务执行，避免重复点击/启动同步与手动同步并发操作同一仓库目录 */
let syncTask: Promise<SyncResult> | null = null;

/** 当前是否有同步任务在执行 */
export function isSyncing(): boolean {
  return syncTask !== null;
}

/**
 * 从 Git 仓库拉取最新文章并更新本地目录（公开仓库固定 HTTPS，无需凭证）。
 * 入口加了互斥：已有任务在执行时直接返回 busy，不会并发操作 .repo-cache。
 */
export async function syncArticlesFromGit(): Promise<SyncResult> {
  if (syncTask) {
    return {
      ok: false,
      busy: true,
      message: "已有同步任务正在执行，请等本次完成后再试",
      logs: getSyncLogs(),
    };
  }
  syncTask = performSync();
  try {
    return await syncTask;
  } finally {
    syncTask = null;
  }
}

async function performSync(): Promise<SyncResult> {
  const repoDir = REPO_CACHE_DIR;
  syncLogs.length = 0;

  log(`开始同步，仓库地址：${REPO_HTTPS_URL}`);
  try {
    let fetched = false;
    let lastFetchErr = "";
    // 本次实际使用的仓库内容目录：git 通道为 .repo-cache；备用通道为 .repo-tarball
    let srcDir = repoDir;

    // 第一步：本地已有仓库 → 优先增量更新（pull），避免每次全量克隆
    if (hasLocalRepo(repoDir)) {
      if (!(await isRepoUsable(repoDir))) {
        // 缓存损坏（半拉 .git 等）→ 清理后走全量克隆重建
        log("本地仓库缓存损坏，清理后重新克隆");
        try { rmrf(repoDir); } catch { /* 忽略清理失败 */ }
      } else {
        log("检测到本地 git 仓库缓存，走增量更新，跳过全量克隆");
        for (let attempt = 1; attempt <= 2 && !fetched; attempt++) {
          if (attempt > 1) {
            log(`等待 3s 后重试增量更新（第 ${attempt}/2 次）...`);
            await new Promise((r) => setTimeout(r, 3000));
          }
          try {
            await updateLocalRepo(repoDir);
            fetched = true;
          } catch (err) {
            lastFetchErr = pickGitError(err);
            log(`第 ${attempt} 次增量更新失败：${lastFetchErr}`);
          }
        }
        // 增量失败但缓存完好：保留缓存，绝不因网络抖动删除 200MB 缓存（否则下次必全量克隆）。
        // 同一网络下全量克隆大概率同样失败，直接转备用通道即可。
        if (!fetched) log("增量更新失败，保留本地仓库缓存，转备用通道");
      }
    }

    // 第二步：无本地仓库（首次同步 / 缓存损坏已清理）→ 全量浅克隆（最多尝试 2 次，间隔 3s，应对偶发网络抖动）
    for (let attempt = 1; attempt <= 2 && !fetched; attempt++) {
      if (attempt > 1) {
        log(`等待 3s 后重试克隆（第 ${attempt}/2 次）...`);
        await new Promise((r) => setTimeout(r, 3000));
      }
      // clone 前彻底清空残留（上次失败/中断可能留下半拉的 .git，导致 File exists 冲突）
      try { rmrf(repoDir); } catch { /* 忽略清理失败，继续尝试 */ }
      try {
        await runGit(["clone", "--depth", "1", REPO_HTTPS_URL, repoDir], "正在通过 HTTPS 浅克隆仓库（--depth 1，仓库约 200MB，需等待）");
        fetched = true;
      } catch (err) {
        lastFetchErr = pickGitError(err);
        log(`第 ${attempt} 次克隆失败：${lastFetchErr}`);
      }
    }

    // 第三步：git 拉取失败 → 备用通道（codeload tar.gz 直链下载，解压到独立目录，不动 .repo-cache）
    if (!fetched) {
      log("git 协议拉取不通，切换备用通道（直接下载仓库压缩包）...");
      fetched = await downloadRepoTarball();
      if (fetched) srcDir = REPO_TARBALL_DIR;
    }

    if (!fetched) {
      log("两条通道均失败：线上环境到 GitHub 的网络当前不通。");
      log("说明：每次部署包已内置最新文章，前台展示不受影响；如需紧急更新文章，请本地拉新仓库后重新部署。");
      return {
        ok: false,
        message: `拉取失败：${lastFetchErr.slice(0, 120)}。部署包已内置最新文章，前台不受影响。`,
        logs: getSyncLogs(),
      };
    }

    // 定位文章根目录：优先仓库内 articles/ 目录，否则用仓库根目录
    let srcRoot = srcDir;
    for (const candidate of ["articles", "Articles", "docs", "wiki"]) {
      if (existsSync(join(srcDir, candidate))) {
        srcRoot = join(srcDir, candidate);
        break;
      }
    }
    log(`文章根目录：${srcRoot === srcDir ? "仓库根目录" : relative(srcDir, srcRoot) + "/"}`);

    // 清空并整体复制（含 md、图片等一切资源文件）。
    // 复制后立即重建清单：目录被清空状态下若进程重启/被清理，
    // 下次启动的 ensureArticlesStore 会因清单为空自动从资产快照兜底恢复。
    log("正在覆盖本地文章目录 uploads/articles/ ...");
    rmrf(ARTICLES_DIR);
    mkdirSync(ARTICLES_DIR, { recursive: true });
    cpSync(srcRoot, ARTICLES_DIR, {
      recursive: true,
      // 排除 . 开头文件、WorkBuddyRaw 素材目录、README 说明文件
      filter: (src) => !relative(srcDir, src).split("/").some((seg) => shouldExcludeSegment(seg)),
    });
    const copied = await rebuildManifest();
    log(`本地已更新：${copied.length} 篇文章就位`);
    // 备用通道的解压目录用完即清，避免与 .repo-cache 双份占用磁盘
    if (srcDir === REPO_TARBALL_DIR) {
      try { rmrf(REPO_TARBALL_DIR); } catch { /* 忽略 */ }
    }

    const entries = copied;
    // 保留本地仓库缓存（.repo-cache）供下次增量更新复用，不再整体删除

    if (entries.length === 0) {
      log("仓库中未找到任何 .md 文章文件");
      return { ok: false, message: "拉取成功，但仓库中未找到任何 .md 文章文件", logs: getSyncLogs() };
    }
    const syncedAt = new Date().toISOString();
    writeFileSync(join(ARTICLES_DIR, ".synced-at"), syncedAt, "utf-8");
    const groups = [...new Set(entries.map((e) => e.dir))];
    log(`同步成功，共 ${entries.length} 篇文章，目录分组：${groups.join("、")}`);
    return { ok: true, message: `同步成功，共 ${entries.length} 篇文章`, count: entries.length, syncedAt, logs: getSyncLogs() };
  } catch (err) {
    // 异常时不清理仓库缓存：下次可继续尝试增量更新，避免退化为全量克隆
    const msg = err instanceof Error ? err.message : String(err);
    log(`同步异常：${msg.slice(0, 300)}`);
    return { ok: false, message: `同步失败：${msg.slice(0, 200)}`, logs: getSyncLogs() };
  }
}

export function lastSyncedAt(): string | null {
  try {
    return readFileSync(join(ARTICLES_DIR, ".synced-at"), "utf-8").trim();
  } catch {
    return null;
  }
}

/** 回退到部署包内置的文章版本（assets/articles），在线拉取失败时兜底 */
export async function restoreBundledArticles(): Promise<void> {
  for (const dir of ["assets/articles", "dist/public/articles", "public/articles"]) {
    const src = join(process.cwd(), dir);
    if (!existsSync(src)) continue;
    rmrf(ARTICLES_DIR);
    mkdirSync(ARTICLES_DIR, { recursive: true });
    cpSync(src, ARTICLES_DIR, {
      recursive: true,
      filter: (s) => !relative(src, s).split("/").some((seg) => shouldExcludeSegment(seg)),
    });
    const entries = await rebuildManifest();
    log(`已回退到部署包内置版本：${entries.length} 篇文章`);
    return;
  }
  log("未找到内置文章资产，无法回退");
}
