import { useCallback, useEffect, useMemo, useState } from "react";
import { Routes, Route } from "react-router";
import { FileText } from "lucide-react";
import { NavigationContext } from "@/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ContentPanel } from "@/components/ContentPanel";
import { ImageLightbox } from "@/components/ImageLightbox";
import Admin from "@/pages/Admin";
import { SITE_TITLE, APP_VERSION, getInitialSection } from "@/data/content";
import { trackVisit } from "@/visit";
import { trpc } from "@/providers/trpc";

/** 对文章路径生成 6 位短码（稳定哈希） */
function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

function MainApp() {
  const [section, setSection] = useState(getInitialSection);
  const articlesQuery = trpc.articles.list.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  /** path → shortCode 双向映射 */
  const { byPath, byCode } = useMemo(() => {
    const bp = new Map<string, string>();
    const bc = new Map<string, string>();
    for (const a of articlesQuery.data ?? []) {
      const code = shortHash(a.path);
      bp.set(a.path, code);
      bc.set(code, a.path);
    }
    return { byPath: bp, byCode: bc };
  }, [articlesQuery.data]);

  const [articlePath, setArticlePath] = useState<string | null>(null);

  // 页面加载时从 URL 的短码还原 articlePath
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("a");
    if (code && articlesQuery.data) {
      const resolved = byCode.get(code);
      if (resolved) setArticlePath(resolved);
    }
  }, [articlesQuery.data, byCode]);

  useEffect(() => {
    trackVisit();
  }, []);

  const selectSection = useCallback((id: string) => {
    setSection(id);
    setArticlePath(null);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", id);
    params.delete("a");
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const selectArticle = useCallback((path: string) => {
    setArticlePath(path);
    setSection("docs");
    const code = byPath.get(path) ?? shortHash(path);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "docs");
    params.set("a", code);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [byPath]);

  const navigateTo = useCallback(
    (id: string) => {
      selectSection(id);
    },
    [selectSection],
  );

  return (
    <NavigationContext.Provider value={{ navigateTo }}>
      <div className="h-screen flex flex-col bg-[#0a0a1a] text-white overflow-hidden">
        <header className="shrink-0 h-14 border-b border-[#1a1a3e] bg-[#0e0e1e] flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#e94560] flex items-center justify-center shrink-0">
            <FileText size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">
              {SITE_TITLE}
              <span className="ml-2 text-[10px] font-normal text-gray-500">{APP_VERSION}</span>
            </h1>
            <p className="text-[10px] text-gray-500 truncate">
              快手直播连屏互动方向架构负责人 · E10→E11
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <span className="px-2 py-0.5 rounded-full bg-[#e94560]/20 text-[#e94560] text-[10px] border border-[#e94560]/30">
              只读预览
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#0f3460]/50 text-gray-400 text-[10px] border border-[#1a1a3e]">
              禁止下载
            </span>
          </div>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <Sidebar
            activeSection={section}
            onSelect={selectSection}
            onSelectArticle={selectArticle}
            activeArticlePath={articlePath}
          />
          <main className="flex-1 overflow-hidden relative">
            <ContentPanel section={section} articlePath={articlePath} />
          </main>
        </div>
      </div>
    </NavigationContext.Provider>
  );
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
      <ImageLightbox />
    </>
  );
}
