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
}

/**
 * 备用通道：直接下载仓库 tar.gz 压缩包并解压到 destDir。
 * 与 git 智能 HTTP 协议走不同端点（codeload.github.com），
 * 线上平台对 github.com git 协议不稳定（HTTP/2 帧层错误 / Empty reply）时可绕过。
 */
async function downloadRepoTarball(destDir: string): Promise<boolean> {
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

      try { rmrf(destDir); } catch { /* 忽略 */ }
      mkdirSync(destDir, { recursive: true });
      // tar.gz 解压并剥掉顶层目录（repo-branch/），内容直接落到 destDir
      await execFileAsync("tar", ["-xzf", tgzPath, "-C", destDir, "--strip-components=1"], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024 });
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

/** 从 Git 仓库拉取最新文章并更新本地目录（公开仓库固定 HTTPS，无需凭证） */
export async function syncArticlesFromGit(): Promise<SyncResult> {
  const tmpDir = join(process.cwd(), "uploads", ".repo-tmp");
  // clone 前彻底清空残留（上次失败/中断可能留下半拉的 .git，导致 File exists 冲突）
  try { rmrf(tmpDir); } catch { /* 忽略清理失败，继续尝试 */ }
  syncLogs.length = 0;

  log(`开始同步，仓库地址：${REPO_HTTPS_URL}`);
  try {
    const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

    // 第一步：git 浅克隆（最多尝试 2 次，间隔 3s，应对偶发网络抖动）
    let fetched = false;
    let lastFetchErr = "";
    for (let attempt = 1; attempt <= 2 && !fetched; attempt++) {
      if (attempt > 1) {
        log(`等待 3s 后重试克隆（第 ${attempt}/2 次）...`);
        await new Promise((r) => setTimeout(r, 3000));
        try { rmrf(tmpDir); } catch { /* 忽略 */ }
      }
      log(`正在通过 HTTPS 浅克隆仓库（--depth 1，仓库约 200MB，需等待）...`);
      try {
        const startedAt = Date.now();
        // 强制 HTTP/1.1：线上环境对 GitHub 的 HTTP/2 帧层不稳定（curl 16 framing layer error）
        const child = execFile(
          "git",
          ["-c", "http.version=HTTP/1.1", "-c", "http.postBuffer=524288000", "clone", "--depth", "1", REPO_HTTPS_URL, tmpDir],
          { env, timeout: 300_000, maxBuffer: 64 * 1024 * 1024 },
        );
        // 逐行收集 stderr（git 进度信息），写入日志
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
        await new Promise<void>((resolve, reject) => {
          child.on("error", reject);
          child.on("close", (code) => (code === 0 ? resolve() : reject(Object.assign(new Error(`git exit ${code}`), { stderr: stderrTail }))));
        });
        log(`克隆完成，耗时 ${Math.round((Date.now() - startedAt) / 1000)}s`);
        fetched = true;
      } catch (err) {
        const e = err as Error & { stderr?: string };
        const raw = [e.stderr, e.message].filter(Boolean).join(" | ");
        // 从 stderr 里挑出 fatal/error 关键行作为用户可读 message（避免被进度刷屏污染）
        const keyLine = (e.stderr || "")
          .split(/\r|\n/)
          .map((l) => l.trim())
          .filter((l) => /^(fatal|error):/i.test(l))
          .slice(-2)
          .join("；");
        lastFetchErr = keyLine || raw.slice(0, 200);
        log(`第 ${attempt} 次克隆失败：${lastFetchErr}`);
      }
    }

    // 第二步：git 拉取失败 → 备用通道（codeload tar.gz 直链下载）
    if (!fetched) {
      log("git 协议拉取不通，切换备用通道（直接下载仓库压缩包）...");
      fetched = await downloadRepoTarball(tmpDir);
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
    let srcRoot = tmpDir;
    for (const candidate of ["articles", "Articles", "docs", "wiki"]) {
      if (existsSync(join(tmpDir, candidate))) {
        srcRoot = join(tmpDir, candidate);
        break;
      }
    }
    log(`文章根目录：${srcRoot === tmpDir ? "仓库根目录" : relative(tmpDir, srcRoot) + "/"}`);

    // 清空并整体复制（含 md、图片等一切资源文件）。
    // 复制后立即重建清单：目录被清空状态下若进程重启/被清理，
    // 下次启动的 ensureArticlesStore 会因清单为空自动从资产快照兜底恢复。
    log("正在覆盖本地文章目录 uploads/articles/ ...");
    rmrf(ARTICLES_DIR);
    mkdirSync(ARTICLES_DIR, { recursive: true });
    cpSync(srcRoot, ARTICLES_DIR, {
      recursive: true,
      // 排除 . 开头文件、WorkBuddyRaw 素材目录、README 说明文件
      filter: (src) => !relative(tmpDir, src).split("/").some((seg) => shouldExcludeSegment(seg)),
    });
    const copied = await rebuildManifest();
    log(`本地已更新：${copied.length} 篇文章就位`);

    const entries = copied;
    rmrf(tmpDir);

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
    rmrf(tmpDir);
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
