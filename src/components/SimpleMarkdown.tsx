import React from "react";

/** 轻量 Markdown 渲染（聊天消息用）：支持标题/列表/分割线/粗体/斜体/行内代码 */
export function renderInline(text: string): string {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>',
    )
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /`(.+?)`/g,
      '<code class="px-1 py-0.5 bg-[#1a1a3e] rounded text-[#e94560] text-xs">$1</code>',
    );
}

/** 「公司工程思路：」前缀高亮 */
export function highlightEngineering(html: string): string {
  return html.replace(
    /公司工程思路[：:]/g,
    '<span class="inline-block px-1.5 py-0.5 rounded bg-[#e94560]/15 text-[#e94560] text-xs font-medium mr-1">公司工程思路</span>：',
  );
}

export function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];
  let idx = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push(
        <ul key={`list-${idx++}`} className="space-y-1 my-2 ml-2">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-gray-300">
              <span className="w-1 h-1 rounded-full bg-[#e94560] mt-2 shrink-0" />
              <span dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
            </li>
          ))}
        </ul>,
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "") {
      flushList();
      continue;
    }
    if (line.trim() === "---") {
      flushList();
      blocks.push(<hr key={`hr-${idx++}`} className="border-gray-700/50 my-3" />);
      continue;
    }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushList();
      blocks.push(
        <h2
          key={`h2-${idx++}`}
          className="text-base font-bold text-white mt-4 mb-2 pb-1 border-b border-[#1a1a3e]"
          dangerouslySetInnerHTML={{
            __html: highlightEngineering(renderInline(h2[1])),
          }}
        />,
      );
      continue;
    }
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushList();
      blocks.push(
        <h3
          key={`h3-${idx++}`}
          className="text-sm font-semibold text-gray-200 mt-3 mb-1.5 flex items-center gap-2"
        >
          <span className="w-1 h-4 bg-[#e94560] rounded-full" />
          <span
            dangerouslySetInnerHTML={{
              __html: highlightEngineering(renderInline(h3[1])),
            }}
          />
        </h3>,
      );
      continue;
    }
    const li = line.match(/^[-•]\s+(.+)$/);
    if (li) {
      listItems.push(li[1]);
      continue;
    }
    flushList();
    blocks.push(
      <p
        key={`p-${idx++}`}
        className="text-gray-300 text-sm leading-relaxed mb-2"
        dangerouslySetInnerHTML={{ __html: highlightEngineering(renderInline(line)) }}
      />,
    );
  }
  flushList();

  return <div className="markdown-content">{blocks}</div>;
}
