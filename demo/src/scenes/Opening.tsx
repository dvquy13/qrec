import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';

const DARK_BG = '#0f172a';

const questions = [
  {text: 'What was I working on last week?', startFrame: 10},
  {text: 'Why did we change the auth middleware?', startFrame: 35},
  {text: 'What did I learn building the indexer?', startFrame: 60},
  {text: 'Claude: what\'s the current state of the project?', startFrame: 85},
  {text: 'Claude: have we solved this problem before?', startFrame: 110},
];

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();

  // Scene opacity: fade in 0→15, fade out 220→240
  const sceneOpacity = interpolate(frame, [0, 15, 220, 240], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Questions fade out after frame 130, gone by 160
  const questionsOpacity = interpolate(frame, [125, 160], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "qrec remembers." fades in 165→200
  const taglineOpacity = interpolate(frame, [165, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: DARK_BG,
        opacity: sceneOpacity,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: theme.sans,
      }}
    >
      {/* Questions */}
      <div
        style={{
          opacity: questionsOpacity,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        {questions.map((q) => {
          const qOpacity = interpolate(frame, [q.startFrame, q.startFrame + 18], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={q.text}
              style={{
                opacity: qOpacity,
                color: 'rgba(255,255,255,0.55)',
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: -0.3,
                textAlign: 'center',
              }}
            >
              {q.text}
            </div>
          );
        })}
      </div>

      {/* Tagline */}
      <div
        style={{
          position: 'absolute',
          opacity: taglineOpacity,
          color: '#ffffff',
          fontSize: 64,
          fontWeight: 700,
          letterSpacing: -2,
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        qrec remembers.
      </div>
    </AbsoluteFill>
  );
};
