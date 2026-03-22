import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {BrowserFrame} from '../components/BrowserFrame';
import {HeatmapGrid} from '../../../ui-react/src/components/HeatmapGrid';
import {HeatmapProjectFilter} from '../../../ui-react/src/components/HeatmapProjectFilter';
import {
  PROJECTS,
  HEATMAP_DAYS,
  HEATMAP_BY_PROJECT,
  HEATMAP_BYPROJECT_BREAKDOWN,
  type Project,
} from '../data/index';

function getSelectedProject(frame: number): Project | null {
  if (frame < 60) return null;
  if (frame < 150) return 'qrec';
  if (frame < 240) return 'api';
  if (frame < 300) return 'dashboard';
  return null;
}

export const ProjectDashboard: React.FC = () => {
  const frame = useCurrentFrame();
  const selectedProject = getSelectedProject(frame);

  const currentDays =
    selectedProject === null ? HEATMAP_DAYS : HEATMAP_BY_PROJECT[selectedProject];

  const subtitleOpacity = interpolate(frame, [340, 360], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneFade durationInFrames={420} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 50px',
          fontFamily: theme.sans,
        }}
      >
        <BrowserFrame
          url="localhost:25927/heatmap"
          style={{width: 1180, height: 380}}
        >
          <div style={{padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: '100%', overflow: 'hidden'}}>
            <HeatmapProjectFilter
              projects={[...PROJECTS]}
              selected={selectedProject}
              onSelect={() => {}}
            />
            <div style={{flex: 1, overflow: 'hidden'}}>
              <HeatmapGrid
                days={currentDays}
                byProject={selectedProject === null ? HEATMAP_BYPROJECT_BREAKDOWN : undefined}
                showWeeklyBars={true}
                showDayLabels={true}
                project={selectedProject ?? undefined}
              />
            </div>
          </div>
        </BrowserFrame>

        {/* Subtitle */}
        {frame >= 340 && (
          <div
            style={{
              marginTop: 20,
              opacity: subtitleOpacity,
              color: theme.textMuted,
              fontSize: 16,
              fontFamily: theme.sans,
              letterSpacing: 0.5,
              textAlign: 'center',
            }}
          >
            Filter by project. See your work through a new lens.
          </div>
        )}
      </AbsoluteFill>
    </SceneFade>
  );
};
