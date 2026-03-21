import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {ClawdMascot} from '../components/ClawdMascot';

const CLAWD_ORANGE = '#D77757';

const QUESTIONS = [
  {text: 'What was I working on last week?', startFrame: 28},
  {text: 'Have we solved this problem before?', startFrame: 86},
];

const CHARS_PER_FRAME = 1.4;

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Scene fade in 0→15, fade out 255→270
  const sceneOpacity = interpolate(frame, [0, 15, 255, 270], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Mascot entrance ──────────────────────────────────────────────────────
  const mascotSpring = spring({frame: frame - 8, fps, config: {damping: 14, stiffness: 140}});
  const mascotOpacity = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mascotScale = interpolate(mascotSpring, [0, 1], [0.3, 1]);
  const mascotBob = Math.sin((frame / fps) * Math.PI * 1.8) * 5;
  const armsUp = frame >= 172 || (frame >= 106 && frame < 118);

  // ── Chapter heading ──────────────────────────────────────────────────────
  // Fades in first (frames 6→20), stays pinned as anchor throughout questions phase
  const headingOpacity = interpolate(frame, [6, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headingSlide = interpolate(
    spring({frame: frame - 6, fps, config: {damping: 200}}),
    [0, 1],
    [-16, 0],
  );

  // ── Questions panel ──────────────────────────────────────────────────────
  const questionsOpacity = interpolate(frame, [130, 155], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const getTyped = (text: string, startFrame: number) =>
    text.substring(0, Math.min(text.length, Math.floor(Math.max(0, frame - startFrame) * CHARS_PER_FRAME)));

  const blinkOn = Math.floor(frame / 15) % 2 === 0;

  // ── Tagline ──────────────────────────────────────────────────────────────
  const taglineSpring = spring({frame: frame - 160, fps, config: {damping: 200}});
  const taglineOpacity = interpolate(frame, [160, 182], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineY = interpolate(taglineSpring, [0, 1], [36, 0]);
  const subtitleOpacity = interpolate(frame, [190, 212], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        opacity: sceneOpacity,
        fontFamily: theme.sans,
        overflow: 'hidden',
      }}
    >
      {/* ── Questions phase — single opacity wrapper so heading + questions fade together ── */}
      <div style={{opacity: questionsOpacity}}>

        {/* Chapter title — anchored top-left, slide deck placeholder */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 60,
            opacity: headingOpacity,
            transform: `translateY(${headingSlide}px)`,
          }}
        >
          <div
            style={{
              fontSize: 50,
              fontWeight: 800,
              letterSpacing: -2,
              lineHeight: 1.1,
              color: '#ffffff',
            }}
          >
            The questions
            <br />
            you keep asking.
          </div>
        </div>

        {/* Questions — centered in the space below the heading */}
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 0,
            bottom: 0,
            width: 600,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 36,
            // Shift the flex center below the heading
            paddingTop: 100,
          }}
        >
          {QUESTIONS.map((q) => {
            const typed = getTyped(q.text, q.startFrame);
            const isDone = typed.length >= q.text.length;
            const isActive = frame >= q.startFrame - 6;
            const qOpacity = interpolate(
              frame,
              [q.startFrame - 6, q.startFrame],
              [0, 1],
              {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
            );
            const showCursor = isActive && (isDone ? blinkOn : true);

            return (
              <div key={q.text} style={{opacity: qOpacity}}>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 500,
                    color: '#ffffff',
                    letterSpacing: -0.4,
                    lineHeight: 1.3,
                  }}
                >
                  {typed}
                  <span
                    style={{
                      opacity: showCursor ? 1 : 0,
                      color: 'rgba(255,255,255,0.6)',
                      fontWeight: 300,
                      marginLeft: 1,
                    }}
                  >
                    |
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ── Right panel: Clawd (white on blue), shifted toward center ── */}
      <div
        style={{
          position: 'absolute',
          right: 140,
          top: 0,
          bottom: 0,
          width: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ClawdMascot
          scale={mascotScale}
          opacity={mascotOpacity}
          bob={mascotBob}
          armsUp={armsUp}
          frame={frame}
          fps={fps}
          color="#ffffff"
          showThoughtBubble
        />
        <div
          style={{
            marginTop: 16,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.55)',
            letterSpacing: 0.3,
            opacity: mascotOpacity,
          }}
        >
          Your Claude Code
        </div>
      </div>

      {/* Vertical divider — adjusted for new right panel position */}
      <div
        style={{
          position: 'absolute',
          left: 740,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 1,
          height: interpolate(frame, [18, 45], [0, 300], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)',
          opacity: questionsOpacity,
        }}
      />

      {/* ── Tagline reveal ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: taglineOpacity,
          transform: `translateY(${taglineY}px)`,
        }}
      >
        <div
          style={{
            fontSize: 84,
            fontWeight: 800,
            letterSpacing: -4,
            color: '#ffffff',
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          qrec{' '}
          <span style={{color: CLAWD_ORANGE}}>remembers.</span>
        </div>

        <div
          style={{
            marginTop: 22,
            fontSize: 22,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: -0.3,
            textAlign: 'center',
            opacity: subtitleOpacity,
          }}
        >
          Your Claude Code sessions, instantly searchable.
        </div>
      </div>
    </AbsoluteFill>
  );
};
