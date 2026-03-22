import React from 'react';

export type LogoColorScheme = 'badge' | 'onBlue';

interface QrecLogoProps {
  size?: number;
  /** 'badge' = white rounded-square container with blue icon (default).
   *  'onBlue' = transparent background, white icon — for the blue scene background. */
  colorScheme?: LogoColorScheme;
}

const BadgeLogo: React.FC<{size: number}> = ({size}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
    <defs>
      <clipPath id="qrec-badge-clip">
        <rect width="512" height="512" rx="112" ry="112" />
      </clipPath>
    </defs>
    <rect width="512" height="512" rx="112" ry="112" fill="#ffffff" />
    <g clipPath="url(#qrec-badge-clip)">
      <circle cx="248" cy="248" r="220" fill="#0062a8" fillOpacity="0.06" />
      <circle cx="248" cy="248" r="174" fill="#0062a8" fillOpacity="0.15" />
      <circle cx="248" cy="248" r="138" fill="#0062a8" />
      <circle cx="248" cy="248" r="82" fill="#ffffff" />
      <line
        x1="346"
        y1="346"
        x2="484"
        y2="484"
        stroke="#0062a8"
        strokeWidth="41"
        strokeLinecap="round"
      />
    </g>
  </svg>
);

// White magnifying glass on transparent background — for placement on the blue scene bg
const OnBlueLogo: React.FC<{size: number}> = ({size}) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={size} height={size}>
    <defs>
      <mask id="qrec-onblue-mask">
        <rect width="512" height="512" fill="white" />
        <circle cx="248" cy="248" r="82" fill="black" />
      </mask>
    </defs>
    <g mask="url(#qrec-onblue-mask)">
      <circle cx="248" cy="248" r="220" fill="#ffffff" fillOpacity="0.12" />
      <circle cx="248" cy="248" r="174" fill="#ffffff" fillOpacity="0.28" />
      <circle cx="248" cy="248" r="138" fill="#ffffff" />
    </g>
    <line
      x1="346"
      y1="346"
      x2="484"
      y2="484"
      stroke="#ffffff"
      strokeWidth="41"
      strokeLinecap="round"
    />
  </svg>
);

export const QrecLogo: React.FC<QrecLogoProps> = ({size = 120, colorScheme = 'badge'}) => {
  return colorScheme === 'onBlue' ? <OnBlueLogo size={size} /> : <BadgeLogo size={size} />;
};
