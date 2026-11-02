'use client';

import { useEffect, useRef, useState } from 'react';

type ImageCropUploadProps = {
  label: string;
  aspectRatio: number;
  maxSizeMB: number;
  onCrop: (file: File, preview: string) => void;
};

export function ImageCropUpload({
  label,
  aspectRatio,
  maxSizeMB,
  onCrop,
}: ImageCropUploadProps) {
  const [source, setSource] = useState('');
  const [fileName, setFileName] = useState('');
  const [zoom, setZoom] = useState(1);
  const [horizontal, setHorizontal] = useState(0);
  const [vertical, setVertical] = useState(0);
  const [error, setError] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!source) return;
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      const baseWidth = width / height > aspectRatio ? height * aspectRatio : width;
      const baseHeight = width / height > aspectRatio ? height : width / aspectRatio;
      const cropWidth = baseWidth / zoom;
      const cropHeight = baseHeight / zoom;
      const maxX = Math.max(0, width - cropWidth);
      const maxY = Math.max(0, height - cropHeight);
      const sx = Math.max(0, Math.min(maxX, maxX / 2 + (horizontal * maxX) / 2));
      const sy = Math.max(0, Math.min(maxY, maxY / 2 + (vertical * maxY) / 2));
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      canvas.width = Math.max(1, Math.min(1920, Math.round(cropWidth)));
      canvas.height = Math.max(1, Math.round(canvas.width / aspectRatio));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    };
    image.onerror = () => setError('图片读取失败，请重新选择。');
    image.src = source;
  }, [source, zoom, horizontal, vertical, aspectRatio]);

  useEffect(() => {
    return () => {
      if (source) URL.revokeObjectURL(source);
    };
  }, [source]);

  function chooseFile(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setError('仅支持 JPG、PNG、WEBP、GIF 图片。');
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`图片不能超过 ${maxSizeMB} MB。`);
      return;
    }
    setError('');
    setFileName(file.name);
    setZoom(1);
    setHorizontal(0);
    setVertical(0);
    setSource(URL.createObjectURL(file));
  }

  function applyCrop() {
    const canvas = canvasRef.current;
    if (!canvas || !source) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError('生成裁剪图片失败，请重试。');
        return;
      }
      const output = new File([blob], fileName.replace(/\.[^.]+$/, '') + '-cropped.jpg', {
        type: 'image/jpeg',
      });
      onCrop(output, canvas.toDataURL('image/jpeg', 0.88));
      setError('');
    }, 'image/jpeg', 0.88);
  }

  return (
    <div className="image-crop-upload">
      <label>
        {label}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            chooseFile(event.target.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </label>
      {source && (
        <div className="image-crop-workspace">
          <div className="image-crop-preview">
            <canvas ref={canvasRef} aria-label="裁剪预览" />
          </div>
          <label>
            缩放
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
          </label>
          <label>
            水平位置
            <input type="range" min="-1" max="1" step="0.01" value={horizontal} onChange={(event) => setHorizontal(Number(event.target.value))} />
          </label>
          <label>
            垂直位置
            <input type="range" min="-1" max="1" step="0.01" value={vertical} onChange={(event) => setVertical(Number(event.target.value))} />
          </label>
          <button type="button" className="outline-btn" onClick={applyCrop}>应用裁剪结果</button>
        </div>
      )}
      {error && <small className="error-text">{error}</small>}
    </div>
  );
}
