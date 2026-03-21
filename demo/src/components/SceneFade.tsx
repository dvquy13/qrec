import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

/**
 * Wraps a scene with a fade-in at the start and fade-out at the end.
 */
export const SceneFade: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
  fadeIn?: number;
  fadeOut?: number;
}> = ({children, durationInFrames, fadeIn = 20, fadeOut = 30}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, fadeIn, durationInFrames - fadeOut, durationInFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  return (
    <AbsoluteFill style={{background: theme.bg, opacity, fontFamily: theme.sans}}>
      {children}
    </AbsoluteFill>
  );
};
