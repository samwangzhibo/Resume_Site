import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";

// 配置 PDF.js worker（vite 下用 ?url 引入本地 worker 文件，避免 CDN 依赖）
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  /** PDF 的 ArrayBuffer 数据（已由上层下载完成） */
  data: ArrayBuffer;
}

/**
 * 基于 PDF.js 的跨端 PDF 渲染器（纵向连续滚动版）：
 * 所有页面纵向堆叠、按需懒渲染（IntersectionObserver），
 * 纯 JS canvas 实现，不依赖浏览器内嵌 PDF 能力，
 * 解决 iOS Safari / 微信内置浏览器 / 安卓 WebView 无法用 <object> 看 PDF 的问题。
 */
export default function PdfCanvasViewer({ data }: PdfCanvasViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  /** 适配宽度缩放（容器宽 / 页宽），zoom 是用户缩放倍率，实际渲染缩放 = fitScale * zoom */
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRefs = useRef<(HTMLDivElement | null)[]>([]);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  /** 每页已渲染的实际缩放值（与目标不符时需重渲染） */
  const renderedScaleRef = useRef<Map<number, number>>(new Map());
  /** 每页高宽比（scale=1 时 h/w），用于渲染前占位高度，避免滚动跳动 */
  const pageAspectsRef = useRef<(number | null)[]>([]);
  /** 全部页面的真实高宽比（加载后一次性测量），占位高度按真实比例计算，
   *  避免横版页面按默认竖版比例占位导致页间出现"空白页" */
  const [pageAspects, setPageAspects] = useState<number[]>([]);
  const renderTasksRef = useRef<Map<number, pdfjsLib.RenderTask>>(new Map());

  // 加载 PDF 文档
  useEffect(() => {
    let cancelled = false;
    setError(null);
    renderedScaleRef.current.clear();
    pageAspectsRef.current = [];
    setPageAspects([]);
    const task = pdfjsLib.getDocument({ data });
    task.promise
      .then(async (doc) => {
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
        // 一次性测量所有页的真实高宽比（只读页面尺寸，不渲染，开销很小）
        const aspects: number[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          try {
            const p = await doc.getPage(i);
            const v = p.getViewport({ scale: 1 });
            aspects.push(v.height / v.width);
          } catch {
            aspects.push(1.414); // 测量失败的页按 A4 竖版兜底
          }
          if (cancelled) return;
        }
        pageAspectsRef.current = aspects;
        setPageAspects(aspects);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[PdfCanvasViewer] 加载失败:", err);
          setError("PDF 解析失败");
        }
      });
    return () => {
      cancelled = true;
      setPdf(null);
      task.destroy().catch(() => {});
    };
  }, [data]);

  // 测量容器宽度 → 计算适配缩放（含窗口 resize / 手机横竖屏切换）
  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    const measure = async () => {
      try {
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        pageAspectsRef.current[0] = viewport.height / viewport.width;
        const cw = (containerRef.current?.clientWidth ?? 800) - 16; // 留边距
        if (!alive) return;
        setContainerWidth(cw);
        setFitScale(Math.min(3, Math.max(0.3, cw / viewport.width)));
      } catch {
        if (alive) setFitScale(1);
      }
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => {
      alive = false;
      window.removeEventListener("resize", onResize);
    };
  }, [pdf]);

  /** 渲染指定页（若已按当前缩放渲染过则跳过） */
  const renderPage = useCallback(
    async (idx: number) => {
      if (!pdf) return;
      const target = +(fitScale * zoom).toFixed(3);
      if (renderedScaleRef.current.get(idx) === target) return;
      // 取消该页未完成的旧渲染
      renderTasksRef.current.get(idx)?.cancel();
      try {
        const page = await pdf.getPage(idx + 1);
        const v1 = page.getViewport({ scale: 1 });
        pageAspectsRef.current[idx] = v1.height / v1.width;
        const viewport = page.getViewport({ scale: target });
        const canvas = canvasRefs.current[idx];
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // 高清屏适配：backing store 按 devicePixelRatio 放大，CSS 缩回逻辑尺寸
        const dpr = Math.min(3, window.devicePixelRatio || 1);
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        // pdfjs 5.x：render 参数要求传 canvas；transform 用 dpr 提升清晰度
        const task = page.render({
          canvas,
          canvasContext: ctx,
          viewport,
          transform: [dpr, 0, 0, dpr, 0, 0],
        } as Parameters<typeof page.render>[0]);
        renderTasksRef.current.set(idx, task);
        await task.promise;
        renderTasksRef.current.delete(idx);
        renderedScaleRef.current.set(idx, target);
      } catch (err) {
        // RenderingCancelledException 是正常取消（缩放/滚动打断），不算错误
        if ((err as Error)?.name !== "RenderingCancelledException") {
          console.error(`[PdfCanvasViewer] 第 ${idx + 1} 页渲染失败:`, err);
        }
      }
    },
    [pdf, fitScale, zoom],
  );

  // 懒渲染：页面进入可视区（含 600px 预加载边距）才渲染；
  // zoom/fitScale 变化时 renderPage 引用变化 → observer 重建 → 可见页自动按新缩放重渲染
  useEffect(() => {
    if (!pdf || numPages === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (en.isIntersecting) {
            const idx = Number((en.target as HTMLElement).dataset.page);
            if (!Number.isNaN(idx)) renderPage(idx);
          }
        }
      },
      { root: containerRef.current, rootMargin: "600px 0px" },
    );
    for (const el of wrapperRefs.current) {
      if (el) obs.observe(el);
    }
    return () => obs.disconnect();
  }, [pdf, numPages, renderPage]);

  // 卸载时取消所有渲染任务
  useEffect(() => {
    const tasks = renderTasksRef.current;
    return () => {
      tasks.forEach((t) => t.cancel());
      tasks.clear();
    };
  }, []);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">{error}</div>
    );
  }

  /** 渲染前占位高度：真实高宽比 × 容器宽 × 用户缩放（未测量到时按 A4 竖版兜底） */
  const estHeight = (idx: number) => {
    const aspect = pageAspects[idx] ?? pageAspectsRef.current[idx] ?? 1.414;
    return Math.round((containerWidth || 600) * aspect * zoom);
  };

  return (
    <div className="w-full h-full relative bg-[#12122a]">
      <div ref={containerRef} className="w-full h-full overflow-auto">
        {/* 吸顶工具栏：页数 + 缩放 */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 border-b border-[#1a1a3e] bg-[#0e0e1e]/90 backdrop-blur">
          <span className="text-[11px] text-gray-400">共 {numPages || "-"} 页 · 上下滑动阅读</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2)))}
              className="p-1.5 rounded bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition"
              title="缩小"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-[11px] text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}
              className="p-1.5 rounded bg-[#1a1a3e] text-gray-300 hover:bg-[#2a2a4e] transition"
              title="放大"
            >
              <ZoomIn size={14} />
            </button>
          </div>
        </div>

        {/* 页面列表：纵向堆叠，逐页懒渲染 */}
        {pdf ? (
          <div className="flex flex-col items-center gap-3 p-2 pb-6">
            {Array.from({ length: numPages }).map((_, idx) => (
              <div
                key={idx}
                data-page={idx}
                ref={(el) => {
                  wrapperRefs.current[idx] = el;
                }}
                className="w-full flex justify-center"
                style={{ minHeight: estHeight(idx) }}
              >
                <canvas
                  ref={(el) => {
                    canvasRefs.current[idx] = el;
                  }}
                  className="rounded shadow-lg bg-white"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <LoaderCircle size={22} className="text-[#e94560] animate-spin" />
            <span className="text-xs">文档解析中...</span>
          </div>
        )}
      </div>
    </div>
  );
}
