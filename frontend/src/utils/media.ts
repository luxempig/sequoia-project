// src/utils/media.ts
export const looksLikeImage = (url?: string | null) =>
  !!url && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url);

export const looksLikeVideo = (url?: string | null) =>
  !!url && /\.(mp4|webm|ogg|mov|m4v)$/i.test(url);
