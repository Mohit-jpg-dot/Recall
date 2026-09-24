import React from 'react';

export type BrowserType = 'chrome' | 'brave' | 'firefox' | 'safari';

export interface RecallIconProps {
  size?: number;
  browser?: BrowserType | null;
  showIndicator?: boolean;
  className?: string;
  style?: React.CSSProperties;
  glow?: boolean;
}

export const RecallIcon: React.FC<RecallIconProps> = ({
  size = 48,
  browser = null,
  showIndicator = true,
  className = '',
  style = {},
  glow = false,
}) => {
  // Browser-specific subtle indicator badge
  const renderBrowserBadge = () => {
    if (!browser || !showIndicator) return null;

    const badgeSize = Math.max(14, Math.round(size * 0.36));
    const offset = Math.round(size * 0.02);

    const getBadgeContent = () => {
      switch (browser) {
        case 'chrome':
          return (
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              {/* Subtle Chromium Indicator */}
              <circle cx="12" cy="12" r="11" fill="#141824" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" />
              <circle cx="12" cy="12" r="5" fill="#4285F4" />
              <path d="M 12 2 A 10 10 0 0 1 20.66 7 L 12 7 Z" fill="#EA4335" />
              <path d="M 20.66 7 A 10 10 0 0 1 17 20.66 L 12.67 13.15 Z" fill="#FBBC05" />
              <path d="M 17 20.66 A 10 10 0 0 1 3.34 17 L 7.67 9.5 Z" fill="#34A853" />
              <circle cx="12" cy="12" r="4.2" fill="#FFFFFF" />
              <circle cx="12" cy="12" r="3.2" fill="#4285F4" />
            </svg>
          );
        case 'brave':
          return (
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              {/* Subtle Brave Shield/Lion Indicator */}
              <circle cx="12" cy="12" r="11" fill="#141824" stroke="#FB542B" strokeWidth="1.2" />
              <path
                d="M 12 4 L 18 7 C 18 13 15 17 12 19 C 9 17 6 13 6 7 Z"
                fill="#FB542B"
              />
              <path
                d="M 12 5.5 L 16.5 8 C 16.5 12.5 14 15.5 12 17.2 C 10 15.5 7.5 12.5 7.5 8 Z"
                fill="#FF7A39"
              />
              <circle cx="12" cy="10.5" r="2" fill="#FFFFFF" />
            </svg>
          );
        case 'firefox':
          return (
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              {/* Subtle Firefox Gecko Indicator */}
              <circle cx="12" cy="12" r="11" fill="#141824" stroke="#FF7139" strokeWidth="1.2" />
              <circle cx="12" cy="12" r="8" fill="#3B1C56" />
              <path
                d="M 17 7 C 14 6 11 7 9 9 C 7 11 7 14 8 16 C 9 18 12 19 15 18 C 17 17.5 19 15.5 19 13 C 19 10 17 7 17 7 Z"
                fill="#FF7139"
              />
              <circle cx="12" cy="12" r="3.5" fill="#FFE169" />
            </svg>
          );
        case 'safari':
          return (
            <svg viewBox="0 0 24 24" width="100%" height="100%">
              {/* Subtle Safari Compass Indicator */}
              <circle cx="12" cy="12" r="11" fill="#141824" stroke="#00A3FF" strokeWidth="1.2" />
              <circle cx="12" cy="12" r="8.5" fill="#006CFF" />
              <polygon points="12,5 14.5,12 12,11.2" fill="#FFFFFF" />
              <polygon points="12,19 9.5,12 12,12.8" fill="#FF3B30" />
              <circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <div
        style={{
          position: 'absolute',
          bottom: `-${offset}px`,
          right: `-${offset}px`,
          width: `${badgeSize}px`,
          height: `${badgeSize}px`,
          borderRadius: '50%',
          backgroundColor: '#090A0F',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        }}
        title={`${browser ? browser.charAt(0).toUpperCase() + browser.slice(1) : ''} indicator`}
      >
        {getBadgeContent()}
      </div>
    );
  };

  const idSuffix = `${size}-${Math.random().toString(36).substring(2, 7)}`;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: glow ? '0 8px 24px -4px rgba(99, 102, 241, 0.5)' : undefined,
        borderRadius: `${Math.round(size * 0.22)}px`,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 128 128"
        width={size}
        height={size}
        style={{ display: 'block', borderRadius: `${Math.round(size * 0.22)}px` }}
      >
        <defs>
          <linearGradient id={`bgGrad-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#141824" />
            <stop offset="50%" stopColor="#0E111A" />
            <stop offset="100%" stopColor="#07080B" />
          </linearGradient>

          <linearGradient id={`rimGrad-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#6366F1" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#EC4899" stopOpacity="0.30" />
          </linearGradient>

          <linearGradient id={`brandGrad-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="42%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>

          <radialGradient id={`sparkGlow-${idSuffix}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="35%" stopColor="#EC4899" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Obsidian Squircle Base */}
        <rect
          x="5"
          y="5"
          width="118"
          height="118"
          rx="27"
          fill={`url(#bgGrad-${idSuffix})`}
          stroke={`url(#rimGrad-${idSuffix})`}
          strokeWidth="2.5"
        />

        {/* Inner Specular Highlight */}
        <rect
          x="7"
          y="7"
          width="114"
          height="114"
          rx="25"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* Subtle Ambient Radial Glow */}
        <circle cx="64" cy="64" r="42" fill="#6366F1" opacity="0.16" />

        {/* Main Recall "R" Aperture & Memory Ribbon */}
        <g fill={`url(#brandGrad-${idSuffix})`}>
          {/* Continuous Body: Stem & Upper Memory Loop */}
          <path
            d="M 31 35
               C 31 30.0 35.0 26 40 26
               L 70 26
               C 83.2 26 94 36.8 94 50
               C 94 63.2 83.2 74 70 74
               L 47 74
               L 47 95
               C 47 99.4 43.4 103 39 103
               C 34.6 103 31 99.4 31 95
               Z"
          />

          {/* Dynamic Diagonal Synapse Leg */}
          <path
            d="M 52 66
               L 81 97
               C 84.5 100.8 90.5 100.8 94 97
               C 97.5 93.5 97.5 87.5 94 84
               L 68 56
               Z"
          />
        </g>

        {/* Inner Loop Negative Space Aperture */}
        <rect x="47" y="40" width="22" height="20" rx="10" fill="#0E111A" />

        {/* Luminous Memory Core Spark inside Aperture */}
        <circle cx="58" cy="50" r="5.5" fill={`url(#sparkGlow-${idSuffix})`} />
        <circle cx="58" cy="50" r="2.5" fill="#FFFFFF" />
      </svg>

      {renderBrowserBadge()}
    </div>
  );
};
