import React from 'react';
import {interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const SlideUp: React.FC<{
  children: React.ReactNode;
  start?: number;
  style?: React.CSSProperties;
}> = ({children, start = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const progress = spring({
    frame: frame - start,
    fps,
    config: {stiffness: 120, damping: 18, mass: 1},
  });

  const opacity = interpolate(frame - start, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const translateY = interpolate(progress, [0, 1], [32, 0]);

  return (
    <div style={{opacity, transform: `translateY(${translateY}px)`, ...style}}>
      {children}
    </div>
  );
};
