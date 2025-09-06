import React, { useState } from 'react';

interface LightboxProps {
  src: string;
  alt: string;
  fullSizeSrc?: string;
}

export default function Lightbox({ src, alt, fullSizeSrc }: LightboxProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{
          cursor: 'zoom-in',
          maxWidth: '400px',
          width: '90%',
          borderRadius: '0.75rem',
          transition: 'transform 0.3s ease',
        }}
        onClick={() => setOpen(true)}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      />
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            cursor: 'zoom-out',
          }}
        >
          <img
            src={fullSizeSrc ? fullSizeSrc : src}
            alt={alt}
            loading="lazy"
            style={{ maxHeight: '90%', maxWidth: '90%', borderRadius: '0.75rem' }}
          />
        </div>
      )}
    </>
  );
}
