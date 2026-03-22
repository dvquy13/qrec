import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export const FadeIn: React.FC<{
  children: React.ReactNode;
  start?: number;
  duration?: number;
  style?: React.CSSProperties;
}> = ({children, start = 0, duration = 20, style}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <div style={{opacity, ...style}}>{children}</div>;
};
