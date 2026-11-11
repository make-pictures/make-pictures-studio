import React, { useCallback, useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';
import { hashToHex } from '@make-pictures/core';
import { PaperCutout3D } from './PaperCutout3D';

export interface ImageCutout3DProps {
  /** Image URL (`staticFile(...)`, HTTP(S), or `data:` URI) */
  src: string;
  /** Optional cache key override (defaults to hashed `src`) */
  cacheKey?: string;
  /** World width in 3D units */
  width: number;
  /** World height in 3D units */
  height: number;
  /** Offscreen canvas pixel width (default 512) */
  pixelWidth?: number;
  /** Offscreen canvas pixel height (default 512) */
  pixelHeight?: number;
  /** Thickness of the cream-white Paper Mario die-cut border in pixels (default 14) */
  whiteBorderPx?: number;
  /** Safe margin around the image so the dilated die-cut border never clips at canvas edges */
  paddingPx?: number;
  /** How the image fits inside the padded cutout bounds (default 'contain') */
  objectFit?: 'contain' | 'cover' | 'fill';
  /** 3D position [x, y, z] */
  position?: [number, number, number];
  /** 3D rotation [rx, ry, rz] in radians */
  rotation?: [number, number, number];
  /** 3D scale (number or [sx, sy, sz]) */
  scale?: number | [number, number, number];
  /** Anchor point ('bottom' | 'center' | 'top', default 'bottom') */
  anchor?: 'bottom' | 'center' | 'top';
  /** Cardboard thickness in 3D units (default 0.038) */
  thickness?: number;
  /** Cast 3D silhouette shadow (default true) */
  castShadow?: boolean;
  /** Receive 3D shadow (default true) */
  receiveShadow?: boolean;
  /** Emissive color for glowing paper elements */
  emissive?: string;
  emissiveIntensity?: number;
  /** Opacity (default 1) */
  opacity?: number;
}

const IMAGE_ELEMENT_CACHE = new Map<string, HTMLImageElement>();
const IMAGE_LOAD_TIMEOUT_MS = 6000;

/**
 * ImageCutout3D — Loads any transparent PNG/SVG/WebP/Data-URI image safely via
 * Remotion `delayRender` / `continueRender` and passes it through `PaperCutout3D`,
 * automatically generating the tactile cream-white dilated die-cut border,
 * kraft cardboard edge, handmade fiber grain, and 3D silhouette shadow casting.
 */
export const ImageCutout3D: React.FC<ImageCutout3DProps> = ({
  src,
  cacheKey,
  width,
  height,
  pixelWidth = 512,
  pixelHeight = 512,
  whiteBorderPx = 14,
  paddingPx,
  objectFit = 'contain',
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  anchor = 'bottom',
  thickness = 0.038,
  castShadow = true,
  receiveShadow = true,
  emissive = '#000000',
  emissiveIntensity = 0,
  opacity = 1,
}) => {
  const safePadding = paddingPx ?? Math.max(24, whiteBorderPx + 14);
  const resolvedCacheKey = cacheKey ?? `img-cutout-${hashToHex(src)}`;

  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(() =>
    IMAGE_ELEMENT_CACHE.get(src) ?? null
  );
  const [loadFailed, setLoadFailed] = useState<boolean>(false);

  const [delayHandle] = useState<number | null>(() => {
    if (typeof Image === 'undefined' || IMAGE_ELEMENT_CACHE.has(src)) {
      return null;
    }
    try {
      return delayRender(`Loading ImageCutout3D (${src.slice(0, 64)})`);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let released = false;
    const release = () => {
      if (!released && delayHandle !== null) {
        released = true;
        try {
          continueRender(delayHandle);
        } catch {
          // Ignore if already continued
        }
      }
    };

    const cached = IMAGE_ELEMENT_CACHE.get(src);
    if (cached) {
      setLoadedImage(cached);
      setLoadFailed(false);
      release();
      return;
    }

    if (typeof Image === 'undefined') {
      release();
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    const timeout = setTimeout(() => {
      if (cancelled) return;
      setLoadFailed(true);
      release();
    }, IMAGE_LOAD_TIMEOUT_MS);

    img.onload = () => {
      clearTimeout(timeout);
      IMAGE_ELEMENT_CACHE.set(src, img);
      if (!cancelled) {
        setLoadedImage(img);
        setLoadFailed(false);
      }
      release();
    };

    img.onerror = () => {
      clearTimeout(timeout);
      if (!cancelled) {
        setLoadFailed(true);
      }
      release();
    };

    img.src = src;

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      release();
    };
  }, [src, delayHandle]);

  const drawImageCutout = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const innerW = Math.max(16, w - safePadding * 2);
      const innerH = Math.max(16, h - safePadding * 2);

      if (loadedImage && loadedImage.naturalWidth > 0 && loadedImage.naturalHeight > 0) {
        const natW = loadedImage.naturalWidth;
        const natH = loadedImage.naturalHeight;

        let drawW = innerW;
        let drawH = innerH;
        let drawX = safePadding;
        let drawY = safePadding;

        if (objectFit === 'contain') {
          const fitScale = Math.min(innerW / natW, innerH / natH);
          drawW = natW * fitScale;
          drawH = natH * fitScale;
          drawX = (w - drawW) / 2;
          drawY = anchor === 'bottom' ? h - safePadding - drawH : (h - drawH) / 2;
        } else if (objectFit === 'cover') {
          const coverScale = Math.max(innerW / natW, innerH / natH);
          drawW = natW * coverScale;
          drawH = natH * coverScale;
          drawX = (w - drawW) / 2;
          drawY = (h - drawH) / 2;
          ctx.save();
          ctx.beginPath();
          ctx.rect(safePadding, safePadding, innerW, innerH);
          ctx.clip();
          ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
          ctx.restore();
          return;
        }

        ctx.drawImage(loadedImage, drawX, drawY, drawW, drawH);
        return;
      }

      if (loadFailed) {
        ctx.fillStyle = '#F1F5F9';
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(safePadding, safePadding, innerW, innerH, 24);
        ctx.fill();
        ctx.stroke();
      }
    },
    [loadedImage, loadFailed, safePadding, objectFit, anchor]
  );

  if (!loadedImage && !loadFailed) {
    return null;
  }

  return (
    <PaperCutout3D
      cacheKey={resolvedCacheKey}
      cacheDeps={[
        src,
        loadedImage ? 1 : 0,
        loadFailed ? 1 : 0,
        safePadding,
        objectFit,
        anchor,
      ]}
      pixelWidth={pixelWidth}
      pixelHeight={pixelHeight}
      width={width}
      height={height}
      draw={drawImageCutout}
      whiteBorderPx={whiteBorderPx}
      position={position}
      rotation={rotation}
      scale={scale}
      anchor={anchor}
      thickness={thickness}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      opacity={opacity}
    />
  );
};
