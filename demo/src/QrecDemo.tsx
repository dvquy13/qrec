import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {theme} from './theme';
import {Problem} from './scenes/Problem';
import {ClaudeRecall} from './scenes/ClaudeRecall';
import {WebUI} from './scenes/WebUI';
import {Architecture} from './scenes/Architecture';
import {CTA} from './scenes/CTA';

// Scene timing (frames @ 30fps)
// Scene 1 — Problem:       0   → 180  (6s)
// Scene 2 — Claude Recall: 150 → 660  (17s, 30 frame overlap/crossfade)
// Scene 3 — Web UI:        630 → 1200 (19s, 30 frame overlap)
// Scene 4 — Architecture: 1170 → 1380 (7s, 30 frame overlap)
// Scene 5 — CTA:          1350 → 1500 (5s, 30 frame overlap)

export const QrecDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: theme.bg, fontFamily: theme.sans, color: theme.text}}>
      <Sequence from={0} durationInFrames={210}>
        <Problem />
      </Sequence>

      <Sequence from={150} durationInFrames={510}>
        <ClaudeRecall />
      </Sequence>

      <Sequence from={630} durationInFrames={570}>
        <WebUI />
      </Sequence>

      <Sequence from={1170} durationInFrames={240}>
        <Architecture />
      </Sequence>

      <Sequence from={1350} durationInFrames={150}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
