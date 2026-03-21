import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {Opening} from './scenes/Opening';
import {Indexing} from './scenes/Indexing';
import {ProjectDashboard} from './scenes/ProjectDashboard';
import {RecentSessions} from './scenes/RecentSessions';
import {ClaudeRecall} from './scenes/ClaudeRecall';
import {SideBySideSearch} from './scenes/SideBySideSearch';
import {SessionDetail} from './scenes/SessionDetail';
import {CTA} from './scenes/CTA';

// Scene timing (frames @ 30fps)
// Opening:          0   → 270  (9s)
// Indexing:         210 → 570  (12s, overlap)
// ProjectDashboard: 510 → 930  (14s, overlap)
// RecentSessions:   870 → 1140 (9s, overlap)
// ClaudeRecall:    1080 → 1350 (9s, overlap)
// SideBySideSearch:1290 → 1590 (10s, overlap)
// SessionDetail:   1530 → 1800 (9s, overlap)
// CTA:             1740 → 1950 (7s, overlap)

export const QrecDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{background: '#0f172a'}}>
      <Sequence from={0} durationInFrames={270}>
        <Opening />
      </Sequence>

      <Sequence from={210} durationInFrames={360}>
        <Indexing />
      </Sequence>

      <Sequence from={510} durationInFrames={420}>
        <ProjectDashboard />
      </Sequence>

      <Sequence from={870} durationInFrames={270}>
        <RecentSessions />
      </Sequence>

      <Sequence from={1080} durationInFrames={270}>
        <ClaudeRecall />
      </Sequence>

      <Sequence from={1290} durationInFrames={300}>
        <SideBySideSearch />
      </Sequence>

      <Sequence from={1530} durationInFrames={270}>
        <SessionDetail />
      </Sequence>

      <Sequence from={1740} durationInFrames={210}>
        <CTA />
      </Sequence>
    </AbsoluteFill>
  );
};
