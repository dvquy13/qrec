import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';

const Node: React.FC<{
  label: string;
  sub?: string;
  startFrame: number;
  highlight?: boolean;
}> = ({label, sub, startFrame, highlight}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const progress = spring({
    frame: frame - startFrame,
    fps,
    config: {stiffness: 140, damping: 18},
  });
  const opacity = interpolate(frame - startFrame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(progress, [0, 1], [0.85, 1]);

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        background: highlight ? theme.blueDim : theme.bg3,
        border: `1px solid ${highlight ? theme.blue : theme.border}`,
        borderRadius: 8,
        padding: '12px 20px',
        textAlign: 'center',
        minWidth: 110,
      }}
    >
      <div
        style={{
          color: highlight ? theme.blue : theme.text,
          fontSize: 15,
          fontWeight: 600,
          fontFamily: theme.mono,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{color: theme.textMuted, fontSize: 12, marginTop: 4}}>
          {sub}
        </div>
      )}
    </div>
  );
};

const Arrow: React.FC<{startFrame: number}> = ({startFrame}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <div
      style={{
        opacity,
        color: theme.textDim,
        fontSize: 18,
        margin: '0 8px',
        alignSelf: 'center',
      }}
    >
      →
    </div>
  );
};

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  // Animated number: 2600 → 55
  const latency = Math.round(
    interpolate(frame, [100, 160], [2600, 55], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  const isfast = latency < 200;

  return (
    <SceneFade durationInFrames={240} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <SlideUp start={0}>
          <h2
            style={{
              color: theme.text,
              fontSize: 33,
              fontWeight: 700,
              margin: 0,
              textAlign: 'center',
              letterSpacing: -1,
            }}
          >
            One persistent daemon. Resident model.
          </h2>
        </SlideUp>

        {/* Pipeline diagram */}
        <div style={{display: 'flex', alignItems: 'center', gap: 0}}>
          <Node label="JSONL" sub="~/.claude/" startFrame={20} />
          <Arrow startFrame={28} />
          <Node label="Indexer" sub="chunk + embed" startFrame={30} />
          <Arrow startFrame={38} />
          <Node label="SQLite" sub="FTS5 + vec" startFrame={40} />
          <Arrow startFrame={48} />
          <Node label="Search" sub="BM25+KNN+RRF" startFrame={50} highlight />
        </div>

        {/* Latency counter */}
        <div
          style={{
            opacity: interpolate(frame, [80, 100], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            display: 'flex',
            alignItems: 'baseline',
            gap: 16,
          }}
        >
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 68,
              fontWeight: 700,
              color: isfast ? theme.blue : '#dc2626',
              transition: 'color 0.3s',
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            {latency}ms
          </span>
          <span
            style={{
              color: theme.textMuted,
              fontSize: 18,
              fontWeight: 400,
            }}
          >
            warm query
          </span>
        </div>

        <div
          style={{
            opacity: interpolate(frame, [165, 185], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            color: theme.textMuted,
            fontSize: 15,
            fontFamily: theme.mono,
          }}
        >
          vs 2,600ms cold start — 47× faster
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
