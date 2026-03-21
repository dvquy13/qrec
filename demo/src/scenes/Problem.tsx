import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {SlideUp} from '../components/SlideUp';

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();

  // Session cards dissolve after frame 80
  const cardsOpacity = interpolate(frame, [80, 140], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cards = [
    {title: 'Rewrote auth middleware', project: 'api', days: '3 days ago'},
    {title: 'Fixed race condition in indexer', project: 'qrec', days: '1 week ago'},
    {title: 'Designed new onboarding flow', project: 'dashboard', days: '2 weeks ago'},
  ];

  return (
    <SceneFade durationInFrames={210} fadeIn={15} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 120px',
        }}
      >
        <SlideUp start={0}>
          <p
            style={{
              color: theme.textMuted,
              fontSize: 15,
              fontFamily: theme.mono,
              textAlign: 'center',
              marginBottom: 12,
              letterSpacing: 2,
              textTransform: 'uppercase',
            }}
          >
            Claude Code Session Ended
          </p>
        </SlideUp>

        {/* Session cards that will dissolve */}
        <div
          style={{
            opacity: cardsOpacity,
            width: '100%',
            maxWidth: 520,
            marginBottom: 40,
          }}
        >
          {cards.map((c, i) => (
            <SlideUp key={c.title} start={i * 8 + 5}>
              <div
                style={{
                  background: theme.bg2,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  marginBottom: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <div>
                  <div style={{color: theme.text, fontSize: 15, fontWeight: 600}}>
                    {c.title}
                  </div>
                  <div
                    style={{
                      color: theme.blue,
                      fontSize: 12,
                      fontFamily: theme.mono,
                      marginTop: 4,
                    }}
                  >
                    {c.project}
                  </div>
                </div>
                <div style={{color: theme.textMuted, fontSize: 13}}>{c.days}</div>
              </div>
            </SlideUp>
          ))}
        </div>

        {/* The punchline — appears as cards fade out */}
        <div
          style={{
            opacity: interpolate(frame, [90, 130], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            transform: `translateY(${interpolate(frame, [90, 130], [10, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}px)`,
            textAlign: 'center',
            position: 'absolute',
          }}
        >
          <p
            style={{
              color: theme.text,
              fontSize: 44,
              fontWeight: 700,
              margin: 0,
              letterSpacing: -1.5,
            }}
          >
            All context. Gone.
          </p>
          <p
            style={{
              color: theme.text,
              fontSize: 20,
              marginTop: 16,
              fontWeight: 400,
            }}
          >
            Every session starts from zero.
          </p>
        </div>
      </AbsoluteFill>
    </SceneFade>
  );
};
