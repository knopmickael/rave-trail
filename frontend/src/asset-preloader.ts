import { assets } from './assets';

const images = new Map<string, HTMLImageElement>();
const queue: string[] = [];
let running = 0;
const CONCURRENCY = 6;

function drain() {
  while (running < CONCURRENCY && queue.length) {
    const src = queue.shift()!;
    const image = images.get(src)!;
    running++;
    const finish = () => {
      image.onload = image.onerror = null;
      running--;
      // Retain successful images for reuse and allow another attempt after a failure.
      if (!image.naturalWidth) images.delete(src);
      drain();
    };
    image.onload = image.onerror = finish;
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = src;
  }
}

/** Discover image URLs as each JSON arrives, rather than waiting for all endpoints. */
export function preloadDataAssets(data: unknown): void {
  if (typeof Image === 'undefined') return;
  if (typeof data === 'string') {
    if (!/^\/media\/.*\.(png|jpe?g|webp|svg|gif|avif)$/i.test(data) || images.has(data)) return;
    images.set(data, new Image());
    queue.push(data);
  } else if (Array.isArray(data)) data.forEach(preloadDataAssets);
  else if (data && typeof data === 'object') Object.values(data).forEach(preloadDataAssets);
  drain();
}

export function preloadGameAssets() { preloadDataAssets(assets); }
