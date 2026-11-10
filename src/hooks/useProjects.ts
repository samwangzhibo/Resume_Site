import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { PROJECTS, RESEARCH_PROJECTS, type ProjectMaterial } from "@/data/content";

export type MaterialCategory = "project" | "research";

/** 项目补充信息（描述文案、Markdown 路径，不在后台编辑范围内） */
const PROJECT_META: Record<string, { desc: string; mdPath?: string }> = {
  engineering: {
    desc: "6年完整周期 · 外部变化驱动内部调整 · 4阶段×4维度演进全景",
    mdPath: "/docs/05-engineering.md",
  },
  hongbao: { desc: "开发成本-85% · 年挽回30亿" },
  lianping: { desc: "五层插件化架构 · PK营收翻倍" },
  ai: { desc: "零额外码率 · CPU-82.6%" },
};

/**
 * 项目材料列表：优先取数据库（后台可编辑），
 * 接口不可用时回退到打包内置的静态默认数据（含静态 PDF）。
 * category: project=项目材料，research=行业调研
 */
export function useProjects(category: MaterialCategory = "project"): ProjectMaterial[] {
  const query = trpc.projects.list.useQuery(
    { category },
    {
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  return useMemo(() => {
    if (!query.data || query.data.length === 0) {
      // 接口不可用/为空时回退到打包内置静态数据（路径与后端 /api/pdfs 一致，含行业调研）
      return category === "project" ? PROJECTS : RESEARCH_PROJECTS;
    }
    return query.data.map((p) => {
      const meta = PROJECT_META[p.id] ?? { desc: "" };
      return {
        id: p.id,
        label: p.label,
        desc: meta.desc,
        mdPath: meta.mdPath,
        pdfPath: p.pdfUrl ?? undefined,
        tags: p.tags.filter((tag) => !/^(?:E\d+|K4A)$/i.test(tag.trim())),
      };
    });
  }, [query.data, category]);
}
