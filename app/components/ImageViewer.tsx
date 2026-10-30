'use client';
import { useState } from 'react';
export function ImageViewer({ src, alt = '图片预览', className = '' }: { src: string; alt?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`image-view-trigger ${className}`} onClick={() => setOpen(true)} aria-label="放大查看图片">
        <img src={src} alt={alt} />
      </button>
      {open && (
        <div className="image-viewer" role="dialog" aria-modal="true" onClick={() => setOpen(false)}>
          <button type="button" className="image-viewer-close" onClick={() => setOpen(false)}>
            ×
          </button>
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
          <small>点击空白处关闭 · 原图查看</small>
        </div>
      )}
    </>
  );
}
