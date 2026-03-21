import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {Opening} from './scenes/Opening';
import {Onboard} from './scenes/Onboard';
import {Indexing} from './scenes/Indexing';
import {ProjectDashboard} from './scenes/ProjectDashboard';
import {RecentSessions} from './scenes/RecentSessions';
import {ClaudeRecall} from './scenes/ClaudeRecall';
import {SideBySideSearch} from './scenes/SideBySideSearch';
import {SessionDetail} from './scenes/SessionDetail';
import {CTA} from './scenes/CTA';

// Scene timing (frames @ 30fps)
// Opening:          0    → 270   (9s)
// Onboard:          210  → 630   (14s = 420f, overlap 60f)
// Indexing:         570  → 930   (12s, overlap 60f)
// ProjectDashboard: 870  → 1290  (14s, overlap 60f)
// RecentSessions:   1230 → 1500  (9s, overlap 60f)
// ClaudeRecall:     1440 → 1710  (9s, overlap 60f)
// SideBySideSearch: 1650 → 1950  (10s, overlap 60f)
// SessionDetail:    1890 → 2160  (9s, overlap 60f)
// CTA:              2100 → 2310  (7s, overlap 60f)

export const QrecDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: '#0f172a'}}>
      <Sequence from={0} durationInFrames={270}>
        <Opening />
      </Sequence>

      <Sequence from={210} durationInFrames={420}>
        <Onboard />
      </Sequence>

      <Sequence from={570} durationInFrames={360}>
        <Indexing />
      </Sequence>

      <Sequence from={870} durationInFrames={420}>
        <ProjectDashboard />
      </Sequence>

      <Sequence from={1230} durationInFrames={270}>
        <RecentSessions />
      </Sequence>

      <Sequence from={1440} durationInFrames={270}>
        <ClaudeRecall />
      </Sequence>

      <Sequence from={1650} durationInFrames={300}>
        <SideBySideSearch />
      </Sequence>

      <Sequence from={1890} durationInFrames={270}>
        <SessionDetail />
      </Sequence>

      <Sequence from={2100} durationInFrames={210}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
