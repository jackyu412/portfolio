import React from 'react';
import type { ImgHTMLAttributes } from 'react';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'async' | 'sync' | 'auto';
  fetchPriority?: 'high' | 'low' | 'auto';
  class?: string;
  className?: string;
}

export default function Image({
  src,
  alt,
  loading = 'lazy',
  decoding = 'async',
  fetchPriority = 'auto',
  style,
  className = '',
  class: cls = '',
  ...props
}: ImageProps) {
  const combinedClassName = [className, cls].filter(Boolean).join(' ');

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      fetchPriority={fetchPriority}
      style={style}
      className={combinedClassName || undefined}
      {...props}
    />
  );
}
