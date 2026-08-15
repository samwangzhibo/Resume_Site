import React, { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import {
  Hash,
  Gift,
  Monitor,
  Cpu,
  GitBranch,
  ChevronDown,
  ChevronRight,
  FileText,
} from "lucide-react";

interface DocMeta {
  id: string;
  title: string;
  path: string;
  icon: React.ReactNode;
}

const DOCS: DocMeta[] = [
  { id: "hongbao", title: "红包架构重构", path: "/docs/02-hongbao.md", icon: <Gift size={16} /> },
  { id: "lianping", title: "连屏技术体系", path: "/docs/03-lianping.md", icon: <Monitor size={16} /> },
  { id: "ai", title: "本地AI人脸特效", path: "/docs/04-ai.md", icon: <Cpu size={16} /> },
  {
    id: "engineering",
    title: "直播工程体系演进",
    path: "/docs/05-engineering.md",
    icon: <GitBranch size={16} />,
  },
];

interface TocItem {
  level: number;
  text: string;
  id: string;
}

function buildToc(md: string): TocItem[] {
  const lines = md.split("\n");
  const toc: TocItem[] = [];
  for (const line of lines) {
    const m = line.match(/^(#{1,3})\s+(.+)$/);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim().replace(/\*\*/g, "");
      const id = text
        .toLowerCase()
        .replace(/[^\w一-鿿]+/g, "-");
      toc.push({ level, text, id });
    }
  }
  return toc;
}

/** 在标题前插入锚点 span，用于目录跳转与滚动监听 */
function insertHeadingAnchors(md: string): string {
  return md.replace(/^(#{1,3})\s+(.+)$/gm, (_match, hashes, title) => {
    const level = hashes.length;
    const id = title
      .trim()
      .replace(/\*\*/g, "")
      .toLowerCase()
      .replace(/[^\w一-鿿]+/g, "-");
    return `${hashes} <span id="${id}" class="heading-anchor" data-level="${level}"></span>${title}`;
  });
}

function TocPanel({
  toc,
  activeId,
  onSelect,
}: {
  toc: TocItem[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      {toc.map((item, i) => {
        const active = item.id === activeId;
        const paddingLeft = item.level === 1 ? 8 : item.level === 2 ? 24 : 40;
        return (
          <button
            key={i}
            onClick={() => onSelect(item.id)}
            className={`w-full text-left rounded-md transition-all duration-150 flex items-center gap-1.5 ${
              active
                ? "bg-[#e94560]/15 text-[#e94560] font-medium"
                : "text-gray-400 hover:bg-[#1a1a3e] hover:text-gray-200"
            }`}
            style={{
              paddingLeft: `${paddingLeft}px`,
              paddingRight: "8px",
              paddingTop: "4px",
              paddingBottom: "4px",
            }}
          >
            {item.level === 1 ? (
              <ChevronRight
                size={12}
                className={`transition-transform ${active ? "rotate-90" : ""}`}
              />
            ) : (
              <Hash size={10} className="opacity-50" />
            )}
            <span
              className={`truncate ${item.level === 1 ? "text-xs" : item.level === 2 ? "text-[11px]" : "text-[10px]"}`}
            >
              {item.text}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function MarkdownViewer() {
  const [activeDocId, setActiveDocId] = useState(DOCS[0].id);
  const [content, setContent] = useState("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [activeHeading, setActiveHeading] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set([DOCS[0].id]));
  const [loading, setLoading] = useState(true);

  const activeDoc = DOCS.find((d) => d.id === activeDocId) || DOCS[0];

  useEffect(() => {
    setLoading(true);
    fetch(activeDoc.path)
      .then((r) => r.text())
      .then((text) => {
        setContent(text);
        const tocItems = buildToc(text);
        setToc(tocItems);
        if (tocItems.length > 0) setActiveHeading(tocItems[0].id);
        setLoading(false);
      })
      .catch((err) => {
        setContent(`# 加载失败\n\n无法加载文档：${activeDoc.path}\n\n错误：${err.message}`);
        setToc([]);
        setLoading(false);
      });
  }, [activeDocId, activeDoc.path]);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveHeading(id);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const anchors = document.querySelectorAll(".heading-anchor");
      let current = "";
      for (const el of Array.from(anchors)) {
        if (el.getBoundingClientRect().top <= 120) current = el.id;
      }
      if (current && current !== activeHeading) setActiveHeading(current);
    };
    const container = document.getElementById("markdown-content");
    if (container) {
      container.addEventListener("scroll", onScroll);
      return () => container.removeEventListener("scroll", onScroll);
    }
  }, [activeHeading, content]);

  const contentWithAnchors = insertHeadingAnchors(content);

  return (
    <div className="h-full flex">
      <div className="w-72 shrink-0 border-r border-[#1a1a3e] bg-[#08081a] flex flex-col">
        <div className="shrink-0 p-3 border-b border-[#1a1a3e]">
          <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-2">
            文档列表
          </h3>
          <div className="space-y-0.5">
            {DOCS.map((doc) => (
              <div key={doc.id}>
                <button
                  onClick={() => {
                    setActiveDocId(doc.id);
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(doc.id)) next.delete(doc.id);
                      else next.add(doc.id);
                      return next;
                    });
                  }}
                  className={`w-full text-left rounded-md transition-all duration-150 flex items-center gap-2 px-2 py-1.5 ${
                    activeDocId === doc.id
                      ? "bg-[#0f3460] text-[#e94560] font-medium"
                      : "text-gray-400 hover:bg-[#1a1a3e] hover:text-gray-200"
                  }`}
                >
                  {expanded.has(doc.id) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  <span className="text-gray-500">{doc.icon}</span>
                  <span className="text-xs truncate">{doc.title}</span>
                </button>
                {activeDocId === doc.id && toc.length > 0 && (
                  <div className="mt-1 pb-2">
                    <TocPanel toc={toc} activeId={activeHeading} onSelect={scrollToHeading} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div id="markdown-content" className="flex-1 overflow-y-auto bg-[#0a0a1a]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-500 text-sm">加载中...</div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-8 py-8">
            <div className="mb-6 pb-4 border-b border-[#1a1a3e]">
              <div className="flex items-center gap-2 text-[#e94560] text-xs mb-1">
                <FileText size={12} />
                <span>{activeDoc.title}</span>
              </div>
            </div>
            <div className="markdown-body">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeRaw, rehypeHighlight]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-2xl font-bold text-white mt-8 mb-4 pb-2 border-b border-[#1a1a3e]">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xl font-semibold text-white mt-6 mb-3 flex items-center gap-2">
                      <span className="w-1 h-5 bg-[#e94560] rounded-full" />
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-300 text-sm leading-relaxed mb-3">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="text-gray-300 text-sm space-y-1 mb-3 ml-4">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="text-gray-300 text-sm space-y-1 mb-3 ml-4 list-decimal">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-[#e94560] mt-2 shrink-0" />
                      <span>{children}</span>
                    </li>
                  ),
                  table: ({ children }) => (
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm border border-[#1a1a3e] rounded-lg">
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => <thead className="bg-[#0f3460]/50">{children}</thead>,
                  tbody: ({ children }) => (
                    <tbody className="divide-y divide-[#1a1a3e]">{children}</tbody>
                  ),
                  tr: ({ children }) => (
                    <tr className="hover:bg-[#1a1a3e]/50 transition-colors">{children}</tr>
                  ),
                  th: ({ children }) => (
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-300 uppercase">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => <td className="px-3 py-2 text-gray-400">{children}</td>,
                  code: ({ children, className }) =>
                    className ? (
                      <pre className="bg-[#0e0e1e] border border-[#1a1a3e] rounded-lg p-4 overflow-x-auto mb-4">
                        <code className={className}>{children}</code>
                      </pre>
                    ) : (
                      <code className="px-1.5 py-0.5 bg-[#1a1a3e] rounded text-[#e94560] text-xs">
                        {children}
                      </code>
                    ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-[#e94560] pl-4 py-1 my-4 bg-[#e94560]/5 rounded-r-lg">
                      {children}
                    </blockquote>
                  ),
                  strong: ({ children }) => (
                    <strong className="text-white font-semibold">{children}</strong>
                  ),
                }}
              >
                {contentWithAnchors}
              </ReactMarkdown>
            </div>
            <div className="h-20" />
          </div>
        )}
      </div>
    </div>
  );
}
