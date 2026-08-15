import React, { useCallback, useEffect, useState } from "react";
import { X, ZoomIn } from "lucide-react";

/**
 * 全局图片灯箱：事件委托捕获页面上所有 <img> 点击，全屏展示。
 * - 排除头像/图标类小图（通过 data-no-zoom 或 class 排除）
 * - ESC / 点击背景 / 点击关闭按钮 退出
 * - 打开时锁定页面滚动
 */
export function ImageLightbox() {
  const [src, setSrc] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  const close = useCallback(() => setSrc(null), []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName !== "IMG") return;
      const img = target as HTMLImageElement;
      // 排除明确标记的小图标/头像
      if (img.dataset.noZoom !== undefined) return;
      if (img.closest("[data-no-zoom]")) return;
      const url = img.currentSrc || img.src;
      if (!url) return;
      // 忽略过小的图标（小于 40px）
      if (img.naturalWidth > 0 && img.naturalWidth < 40) return;
      setSrc(url);
      setAlt(img.alt || "");
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [src, close]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 cursor-zoom-out"
      onClick={close}
    >
      <button
        onClick={close}
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
        aria-label="关闭"
      >
        <X size={18} />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-w-full max-h-[92vh] object-contain rounded-lg shadow-2xl select-none"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
      {alt && <p className="mt-3 text-xs text-gray-400 max-w-2xl text-center truncate">{alt}</p>}
    </div>
  );
}

/** 给可点击放大的图片加 hover 提示样式（可选包裹器） */
export function ZoomableImage({
  src,
  alt,
  className,
  style,
  draggable,
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <span className="relative inline-block group/zoom">
      <img src={src} alt={alt} className={`${className ?? ""} cursor-zoom-in`} style={style} draggable={draggable} />
      <span className="absolute top-2 right-2 opacity-0 group-hover/zoom:opacity-100 transition pointer-events-none">
        <span className="w-6 h-6 rounded bg-black/60 flex items-center justify-center">
          <ZoomIn size={12} className="text-white" />
        </span>
      </span>
    </span>
  );
}
