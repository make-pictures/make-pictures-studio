import React, { useId } from 'react';

export interface BrandMarkSvgProps {
  /** Rendered width & height in CSS pixels. */
  size?: number;
  className?: string;
  title?: string;
}

/**
 * Official make.pictures "Frames in Motion" 3-layer signet:
 * Electric Violet back frame, Cyber Cyan middle frame, and Coral → Orange → Solar Amber hero frame
 * with a crisp white Play glyph and signature top-right dot.
 *
 * Gradient IDs are derived from `React.useId()` so multiple mounts on one page never clash.
 */
export const BrandMarkSvg: React.FC<BrandMarkSvgProps> = ({
  size = 36,
  className,
  title,
}) => {
  const rawId = useId();
  const uid = rawId.replace(/[^A-Za-z0-9_-]/g, '');
  const backId = `mp-back-${uid}`;
  const midId = `mp-mid-${uid}`;
  const frontId = `mp-front-${uid}`;

  return (
    <svg
      viewBox="0 0 240 240"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ flexShrink: 0, display: 'block' }}
    >
      <defs>
        <linearGradient
          id={backId}
          x1="30"
          y1="30"
          x2="160"
          y2="160"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#7209B7" />
          <stop offset="100%" stopColor="#3A0CA3" />
        </linearGradient>
        <linearGradient
          id={midId}
          x1="50"
          y1="45"
          x2="185"
          y2="180"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00F5D4" />
          <stop offset="100%" stopColor="#0096C7" />
        </linearGradient>
        <linearGradient
          id={frontId}
          x1="65"
          y1="65"
          x2="205"
          y2="205"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#FF2A85" />
          <stop offset="55%" stopColor="#FF5E00" />
          <stop offset="100%" stopColor="#FFBE0B" />
        </linearGradient>
      </defs>
      {/* Back Frame (Electric Violet) */}
      <rect
        x="34"
        y="34"
        width="124"
        height="124"
        rx="30"
        transform="rotate(-10 96 96)"
        fill={`url(#${backId})`}
      />
      {/* Middle Frame (Cyber Cyan) */}
      <rect
        x="52"
        y="50"
        width="128"
        height="128"
        rx="32"
        transform="rotate(-3 116 114)"
        fill={`url(#${midId})`}
      />
      {/* Front Hero Frame (Coral -> Orange -> Solar Amber) */}
      <rect
        x="70"
        y="68"
        width="134"
        height="134"
        rx="34"
        fill={`url(#${frontId})`}
      />
      {/* Crisp White Play Symbol */}
      <path
        d="M119 109.5C119 104.8 124.1 101.9 128.2 104.3L166.8 127.2C170.8 129.6 170.8 135.4 166.8 137.8L128.2 160.7C124.1 163.1 119 160.2 119 155.5V109.5Z"
        fill="#FFFFFF"
      />
      {/* Signature Dot in Top-Right */}
      <circle cx="182" cy="90" r="8" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
};

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  /** Optional pill badge rendered after the wordmark, e.g. `60 FPS`. */
  badge?: string;
  /** Render the wordmark for dark backgrounds. */
  darkText?: boolean;
}

const MARK_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 32,
  md: 40,
  lg: 54,
};

const WORDMARK_PX: Record<NonNullable<BrandLogoProps['size']>, number> = {
  sm: 18,
  md: 22,
  lg: 30,
};

/**
 * make.pictures signet + `make.pictures` wordmark (`make` ink, `.` coral, `pictures` blue).
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  badge,
  darkText = false,
}) => (
  <div className="mp-brand-logo">
    <BrandMarkSvg size={MARK_PX[size]} />
    <span
      className="mp-brand-wordmark"
      style={{ fontSize: WORDMARK_PX[size] }}
      aria-label="make.pictures"
    >
      <span style={{ color: darkText ? '#FFFFFF' : '#0F172A' }}>make</span>
      <span style={{ color: '#FF2A85' }}>.</span>
      <span style={{ color: darkText ? '#60A5FA' : '#2563EB' }}>pictures</span>
    </span>
    {badge ? <span className="mp-brand-badge">{badge}</span> : null}
  </div>
);
