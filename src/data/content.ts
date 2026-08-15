export interface ProjectMaterial {
  id: string;
  label: string;
  desc: string;
  mdPath?: string;
  pdfPath?: string;
  imagePath?: string;
  tags: string[];
}

export const PROJECTS: ProjectMaterial[] = [
  {
    id: "engineering",
    label: "直播工程体系演进",
    desc: "6年完整周期 · 外部变化驱动内部调整 · 4阶段×4维度演进全景",
    mdPath: "/docs/05-engineering.md",
    tags: ["架构演进", "工程体系", "全链路"],
  },
  {
    id: "hongbao",
    label: "红包架构重构",
    desc: "K4A 晋升核心项目 · 开发成本-85% · 年挽回30亿",
    pdfPath: "/api/pdfs/hongbao.pdf",
    tags: ["架构重构", "K4A", "商业化"],
  },
  {
    id: "lianping",
    label: "连屏技术体系演进",
    desc: "E11 晋升核心项目 · 五层插件化架构 · PK营收翻倍",
    pdfPath: "/api/pdfs/lianping.pdf",
    tags: ["架构演进", "E11", "音视频"],
  },
  {
    id: "ai",
    label: "本地 AI 人脸特效",
    desc: "E11 晋升核心项目 · 零额外码率 · CPU-82.6%",
    pdfPath: "/api/pdfs/ai.pdf",
    tags: ["AI Native", "成本优化", "端侧推理"],
  },
];

/** 行业调研（接口不可用时的静态兜底，与后端默认条目一致） */
export const RESEARCH_PROJECTS: ProjectMaterial[] = [
  {
    id: "research-ads",
    label: "广告商业化行业观察",
    desc: "从卖流量到卖决策 · 商业化行业调研",
    pdfPath: "/api/pdfs/research-ads.pdf",
    tags: ["商业化", "广告", "行业调研"],
  },
  {
    id: "research-llm",
    label: "大模型的下半场",
    desc: "客户端能做什么 · Agent 行业调研",
    pdfPath: "/api/pdfs/research-llm.pdf",
    tags: ["大模型", "Agent", "行业调研"],
  },
];

export const SECTION_IDS = [
  "profile",
  "model",
  "digital-twin",
  "docs",
  "engineering",
  "hongbao",
  "lianping",
  "ai",
];

export const SITE_TITLE = "能力模型与项目材料库";
/** 站点版本号（每次部署更新，用于确认线上跑的是哪个版本） */
export const APP_VERSION = "v20260812.4";

export function getInitialSection(): string {
  if (typeof window === "undefined") return "profile";
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && SECTION_IDS.includes(tab) ? tab : "profile";
}
