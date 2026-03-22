import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {BrowserFrame} from '../components/BrowserFrame';
import {ActivityFeed} from '../../../ui-react/src/components/ActivityFeed';
import {StatCard} from '../../../ui-react/src/components/StatCard';
import {
  ACTIVITY_SEQUENCE,
  type ActivityState,
} from '../data/index';

function getCurrentState(frame: number): ActivityState {
  let current = ACTIVITY_SEQUENCE[0];
  for (const state of ACTIVITY_SEQUENCE) {
    if (state.frame <= frame) current = state;
    else break;
  }
  return current;
}

export const Indexing: React.FC = () => {
  const frame = useCurrentFrame();
  const state = getCurrentState(frame);

  // Sessions count
  const sessionsCount =
    state.type === 'indexing' ? (state.count ?? 0) :
    state.type === 'enriching' ? 847 :
    state.type === 'ready' ? 847 : 0;

  // Summaries count
  const summariesCount =
    state.type === 'enriching' ? (state.count ?? 0) :
    state.type === 'ready' ? 847 : 0;

  // Build RunGroups for ActivityFeed
  type RunGroupType = import('../../../ui-react/src/components/ActivityFeed').RunGroup;
  let groups: RunGroupType[] = [];

  if (state.type === 'model_download') {
    groups = [{
      type: 'model_download',
      running: true,
      ts: Date.now(),
      events: [],
      syntheticProgress: {percent: state.progress ?? 0, label: `${state.progress ?? 0}%`},
    }];
  } else if (state.type === 'model_loading') {
    groups = [{
      type: 'model_loading',
      running: true,
      ts: Date.now(),
      events: [],
      syntheticProgress: {percent: null, label: 'Loading...'},
    }];
  } else if (state.type === 'indexing') {
    groups = [{
      type: 'index',
      running: true,
      ts: Date.now(),
      events: [],
      syntheticLabel: `Indexing — ${state.count ?? 0}/${state.total ?? 847}`,
    }];
  } else if (state.type === 'enriching') {
    groups = [{
      type: 'enrich',
      running: true,
      ts: Date.now(),
      events: [],
      syntheticLabel: `Enriching — ${state.count ?? 0}/${state.total ?? 847}`,
    }];
  } else if (state.type === 'ready') {
    groups = [
      {
        type: 'index',
        running: false,
        ts: Date.now(),
        events: [],
        syntheticLabel: 'Indexed 847 sessions',
      },
      {
        type: 'enrich',
        running: false,
        ts: Date.now(),
        events: [],
        syntheticLabel: 'Enriched 847 sessions',
      },
    ];
  }

  const subtitleOpacity = interpolate(frame, [260, 290], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneFade durationInFrames={360} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 50px',
          fontFamily: theme.sans,
          position: 'relative',
        }}
      >
        <BrowserFrame
          url="localhost:25927"
          style={{width: 760, height: 420}}
        >
          <div style={{padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden'}}>
            {/* Stat cards row */}
            <div style={{display: 'flex', gap: 16}}>
              <div style={{flex: 1, background: theme.bg2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 16}}>
                <StatCard
                  label="Sessions"
                  value={sessionsCount}
                  pulsing={state.type === 'indexing'}
                />
              </div>
              <div style={{flex: 1, background: theme.bg2, border: `1px solid ${theme.border}`, borderRadius: 8, padding: 16}}>
                <StatCard
                  label="AI Summaries"
                  value={summariesCount}
                  pulsing={state.type === 'enriching'}
                />
              </div>
            </div>

            {/* Activity feed */}
            <div style={{flex: 1, overflow: 'hidden'}}>
              <ActivityFeed groups={groups} />
            </div>
          </div>
        </BrowserFrame>

        {/* Subtitle */}
        {frame >= 260 && (
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
            Indexed and enriched locally. Your models, your machine.
          </div>
        )}
      </AbsoluteFill>
    </SceneFade>
  );
};
