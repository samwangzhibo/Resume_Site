import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  User,
  Layers,
  Bot,
  GitBranch,
  Gift,
  Monitor,
  Cpu,
  ChevronRight,
  ChevronLeft,
  FileText,
  LoaderCircle,
  Shield,
  Search,
} from "lucide-react";
import { type ProjectMaterial } from "@/data/content";
import { useProjects } from "@/hooks/useProjects";

const NAV_ITEMS = [
  { id: "profile", label: "个人简介", shortLabel: "简介", icon: <User size={16} /> },
  { id: "model", label: "能力模型", shortLabel: "能力", icon: <Layers size={16} /> },
  { id: "digital-twin", label: "数字分身", shortLabel: "分身", icon: <Bot size={16} /> },
];

const PROJECT_ICONS: Record<string, React.ReactNode> = {
  engineering: <GitBranch size={16} />,
  hongbao: <Gift size={16} />,
  lianping: <Monitor size={16} />,
  ai: <Cpu size={16} />,
};

const PROJECT_SHORT: Record<string, string> = {
  engineering: "直播",
  hongbao: "红包",
  lianping: "连屏",
  ai: "AI",
};

const RESEARCH_ICON = <Search size={16} />;

const WIDTH_DEFAULT = 170;
const WIDTH_COLLAPSED = 48;
const WIDTH_MIN = 140;
const WIDTH_MAX = 320;

interface SidebarProps {
  activeSection: string;
  onSelect: (id: string) => void;
  onSelectArticle?: (path: string) => void;
  activeArticlePath?: string | null;
}

export function Sidebar({
  activeSection,
  onSelect,
  onSelectArticle,
  activeArticlePath,
}: SidebarProps) {
  const [width, setWidth] = useState(WIDTH_DEFAULT);
  const [collapsed, setCollapsed] = useState(false);
  const [resizing, setResizing] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(WIDTH_DEFAULT);
  const [isMobile, setIsMobile] = useState(false);
  const projects = useProjects("project");
  const research = useProjects("research");

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      setWidth(c ? WIDTH_DEFAULT : WIDTH_COLLAPSED);
      return !c;
    });
  }, []);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (collapsed) return;
      e.preventDefault();
      setResizing(true);
      dragStartX.current = e.clientX;
      dragStartWidth.current = width;
    },
    [collapsed, width],
  );

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const next = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, dragStartWidth.current + delta));
      setWidth(next);
      setCollapsed(false);
    };
    const onUp = () => setResizing(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  const isCollapsed = collapsed || width <= WIDTH_COLLAPSED + 10;

  return (
    <>
      <aside
        ref={asideRef}
        className="shrink-0 bg-[#0e0e1e] border-r border-[#1a1a3e] flex flex-col overflow-hidden relative select-none"
        style={{ width: isMobile ? (isCollapsed ? WIDTH_COLLAPSED : WIDTH_DEFAULT) : width }}
      >
        <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-end"} px-2 py-2`}>
          <button
            onClick={toggleCollapse}
            className="w-7 h-7 rounded-lg bg-[#1a1a3e] hover:bg-[#2a2a4e] flex items-center justify-center text-gray-400 hover:text-gray-200 transition"
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        <div className="px-2 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center rounded-md text-xs font-medium transition-all ${
                activeSection === item.id && !activeArticlePath
                  ? "bg-[#e94560]/15 text-[#e94560] border border-[#e94560]/30"
                  : "text-gray-400 hover:bg-[#1a1a3e] hover:text-gray-200 border border-transparent"
              } ${isCollapsed ? "flex-col px-0 py-1.5" : "px-2.5 py-1.5 gap-2"}`}
              title={isCollapsed ? item.label : undefined}
            >
              {item.icon}
              {isCollapsed ? (
                <span className="text-[10px] mt-0.5 scale-90">{item.shortLabel}</span>
              ) : (
                <span>{item.label}</span>
              )}
            </button>
          ))}
        </div>

        <div className="mx-3 h-px bg-[#1a1a3e] my-2" />

        <div className="flex-1 overflow-auto sidebar-scroll">
          <div className={`${isCollapsed ? "px-1" : "px-2"}`}>
            {isCollapsed ? (
              <div className="text-center mb-1.5">
                <span className="text-[9px] text-gray-600 font-medium">项目</span>
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 px-3">
                项目材料
              </p>
            )}
            <div className="space-y-1.5">
              {projects.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  isActive={activeSection === p.id && !activeArticlePath}
                  onSelect={onSelect}
                  collapsed={isCollapsed}
                />
              ))}
            </div>
          </div>

          {research.length > 0 && (
            <div className={`mt-3 ${isCollapsed ? "px-1" : "px-2"}`}>
              {isCollapsed ? (
                <div className="text-center mb-1.5">
                  <span className="text-[9px] text-gray-600 font-medium">调研</span>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 px-3">
                  行业调研
                </p>
              )}
              <div className="space-y-1.5">
                {research.map((p) => (
                  <ResearchCard
                    key={p.id}
                    project={p}
                    isActive={activeSection === p.id && !activeArticlePath}
                    onSelect={onSelect}
                    collapsed={isCollapsed}
                  />
                ))}
              </div>
            </div>
          )}

          {onSelectArticle && (
            <div className={`mt-3 ${isCollapsed ? "px-1" : "px-2"}`}>
              {isCollapsed ? (
                <div className="text-center mb-1.5">
                  <span className="text-[9px] text-gray-600 font-medium">文章</span>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 px-3">
                  技术文章
                </p>
              )}
              <ArticleList
                onSelectArticle={onSelectArticle}
                activeArticlePath={activeArticlePath ?? null}
                collapsed={isCollapsed}
              />
            </div>
          )}
        </div>

        <div className="p-2 border-t border-[#1a1a3e]">
          <AdminButton collapsed={isCollapsed} />
        </div>

        {!isCollapsed && (
          <div
            className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-[#e94560]/30 transition ${resizing ? "bg-[#e94560]/50" : "bg-transparent"}`}
            onMouseDown={onResizeStart}
            style={{ transform: "translateX(50%)" }}
          />
        )}
      </aside>
    </>
  );
}

function ProjectCard({
  project,
  isActive,
  onSelect,
  collapsed,
}: {
  project: ProjectMaterial;
  isActive: boolean;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const short = PROJECT_SHORT[project.id] || project.label.slice(0, 2);
  return (
    <button
      onClick={() => onSelect(project.id)}
      className={`w-full rounded-lg border transition-all overflow-hidden ${
        isActive
          ? "bg-[#e94560]/10 border-[#e94560]/40"
          : "bg-[#12122a] border-[#1a1a3e] hover:border-[#2a2a4e]"
      } ${collapsed ? "flex flex-col items-center py-1.5" : ""}`}
    >
      {collapsed ? (
        <>
          <span className={isActive ? "text-[#e94560]" : "text-gray-500"}>
            {PROJECT_ICONS[project.id]}
          </span>
          <span
            className={`text-[10px] mt-0.5 scale-90 ${isActive ? "text-[#e94560]" : "text-gray-500"}`}
          >
            {short}
          </span>
        </>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className={isActive ? "text-[#e94560]" : "text-gray-500"}>
            {PROJECT_ICONS[project.id]}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs font-medium truncate ${isActive ? "text-[#e94560]" : "text-gray-300"}`}
            >
              {project.label}
            </p>
            <p className="text-[10px] text-gray-500 truncate">{project.desc}</p>
          </div>
          <FileText size={12} className={isActive ? "text-[#e94560]" : "text-gray-600"} />
        </div>
      )}
    </button>
  );
}

function ResearchCard({
  project,
  isActive,
  onSelect,
  collapsed,
}: {
  project: ProjectMaterial;
  isActive: boolean;
  onSelect: (id: string) => void;
  collapsed: boolean;
}) {
  const short = project.label.slice(0, 2);
  return (
    <button
      onClick={() => onSelect(project.id)}
      className={`w-full rounded-lg border transition-all overflow-hidden ${
        isActive
          ? "bg-[#e94560]/10 border-[#e94560]/40"
          : "bg-[#12122a] border-[#1a1a3e] hover:border-[#2a2a4e]"
      } ${collapsed ? "flex flex-col items-center py-1.5" : ""}`}
    >
      {collapsed ? (
        <>
          <span className={isActive ? "text-[#e94560]" : "text-gray-500"}>{RESEARCH_ICON}</span>
          <span
            className={`text-[10px] mt-0.5 scale-90 ${isActive ? "text-[#e94560]" : "text-gray-500"}`}
          >
            {short}
          </span>
        </>
      ) : (
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className={isActive ? "text-[#e94560]" : "text-gray-500"}>{RESEARCH_ICON}</span>
          <div className="min-w-0 flex-1">
            <p
              className={`text-xs font-medium truncate ${isActive ? "text-[#e94560]" : "text-gray-300"}`}
            >
              {project.label}
            </p>
            {project.tags.length > 0 && (
              <p className="text-[10px] text-gray-500 truncate">{project.tags.join(" · ")}</p>
            )}
          </div>
          <FileText size={12} className={isActive ? "text-[#e94560]" : "text-gray-600"} />
        </div>
      )}
    </button>
  );
}

interface ArticleMeta {
  dir: string;
  file: string;
  title: string;
  path: string;
}

function ArticleList({
  onSelectArticle,
  activeArticlePath,
  collapsed,
}: {
  onSelectArticle: (path: string) => void;
  activeArticlePath: string | null;
  collapsed: boolean;
}) {
  const query = trpc.articles.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const articles = useMemo<ArticleMeta[]>(() => query.data ?? [], [query.data]);
  const loading = query.isLoading;
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeArticlePath, query.data]);

  /** 按顶层目录分组，保持原始顺序 */
  const groups = useMemo(() => {
    const map = new Map<string, ArticleMeta[]>();
    for (const a of articles) {
      const list = map.get(a.dir) ?? [];
      list.push(a);
      map.set(a.dir, list);
    }
    return [...map.entries()];
  }, [articles]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-4">
        <LoaderCircle size={14} className="text-gray-500 animate-spin" />
      </div>
    );

  if (groups.length === 0)
    return <p className="text-[10px] text-gray-600 px-3 py-2">暂无文章</p>;

  if (collapsed) {
    return (
      <div className="space-y-1">
        {groups.map(([dir, items]) => {
          const active = items.some((a) => activeArticlePath === a.path);
          return (
            <button
              key={dir}
              ref={active ? activeRef : undefined}
              onClick={() => onSelectArticle(items[0].path)}
              className={`w-full flex justify-center py-1.5 rounded-lg border transition-all ${
                active
                  ? "bg-[#e94560]/10 border-[#e94560]/40"
                  : "bg-[#12122a] border-[#1a1a3e] hover:border-[#2a2a4e]"
              }`}
              title={dir}
            >
              <span className={`text-[10px] scale-90 ${active ? "text-[#e94560]" : "text-gray-500"}`}>
                {dir.slice(0, 2)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {groups.map(([dir, items]) => (
        <div key={dir}>
          <p className="text-[10px] font-medium text-gray-500 px-3 mb-1 truncate" title={dir}>
            {dir}
          </p>
          <div className="space-y-1">
            {items.map((a) => {
              const active = activeArticlePath === a.path;
              return (
                <button
                  key={a.path}
                  ref={active ? activeRef : undefined}
                  onClick={() => onSelectArticle(a.path)}
                  className={`w-full text-left rounded-lg border transition-all overflow-hidden px-3 py-2 ${
                    active
                      ? "bg-[#e94560]/10 border-[#e94560]/40"
                      : "bg-[#12122a] border-[#1a1a3e] hover:border-[#2a2a4e]"
                  }`}
                  title={a.title}
                >
                  <span className={`text-xs truncate block ${active ? "text-[#e94560]" : "text-gray-300"}`}>
                    {a.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminButton({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/admin")}
      className={`w-full flex items-center rounded-lg text-xs text-gray-500 hover:text-[#e94560] hover:bg-[#1a1a3e] transition ${
        collapsed ? "justify-center py-1.5" : "gap-2 px-3 py-2"
      }`}
      title="管理后台"
    >
      <Shield size={14} />
      {!collapsed && <span>后台</span>}
    </button>
  );
}
