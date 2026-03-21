import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';

const questions = [
  {text: 'What was I working on last week?', startFrame: 25},
  {text: 'Why did we change the auth middleware?', startFrame: 52},
  {text: 'What did I learn building the indexer?', startFrame: 79},
  {text: 'Have we solved this problem before?', startFrame: 106},
];

// ─── Clawd pixel mascot ────────────────────────────────────────────────────
// Reconstructed from claude binary (rgb(215,119,87) = #D77757).
// Unicode block chars decoded to a sub-pixel grid (12px wide × 22px tall each).
// Grid: 18 sub-cols wide × 6 sub-rows tall. viewBox="0 0 216 132"
//
// Poses extracted from WlR in binary:
//   default  : r1L=" ▐"  r1E="▛███▜" r1R="▌"  r2L="▝▜" r2R="▛▘"
//   arms-up  : r1L="▗▟"  r1E="▛███▜" r1R="▙▖" r2L=" ▜" r2R="▛ "
// Row 3 (feet): "  ▘▘ ▝▝  "
//
// Pixel maps (O=#D77757, _=transparent):
//   row0 (head top)  : cols 3-14  → same both poses
//   row1 default     : cols 3-4, 6-11, 13-14  (eyes = gaps at 5, 12)
//   row1 arms-up     : cols 1-4, 6-11, 13-16  (arms extend outward)
//   row2 (body top)  : cols 1-16 default / cols 2-15 arms-up
//   row3 (body bot)  : cols 3-14  → same both poses
//   row4 (feet)      : cols 4, 6, 11, 13  → same both poses

const C = '#D77757'; // clawd_body from binary: rgb(215,119,87)
const PW = 12; // sub-pixel width
const PH = 22; // sub-pixel height

// Thought bubble: 3 pixel dots escalating → main bubble with "?"
// All drawn in SVG space above the mascot head (negative y).
// ABOVE_H = pixels of space added above the mascot in the viewBox.
const ABOVE_H = 110;

// Dot positions (x, y in SVG coords, y is negative = above mascot)
const DOT1 = {x: 157, y: -16, s: 7};  // small, near head
const DOT2 = {x: 162, y: -40, s: 11}; // medium
const DOT3 = {x: 168, y: -66, s: 15}; // large
const BUB  = {x: 134, y: -108, w: 62, h: 46, rx: 6}; // main bubble
const BUB_CX = BUB.x + BUB.w / 2; // 165
const BUB_CY = BUB.y + BUB.h / 2; // -85

const ClawdMascot: React.FC<{
  scale: number;
  opacity: number;
  bob: number;
  armsUp: boolean;
  frame: number;
  fps: number;
}> = ({scale, opacity, bob, armsUp, frame, fps}) => {
  // Thought bubble progressive reveal
  const showBubble = frame < 140;
  const dot1Op = interpolate(frame, [30, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dot2Op = interpolate(frame, [42, 54], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dot3Op = interpolate(frame, [54, 64], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bubSp  = spring({frame: frame - 62, fps, config: {damping: 10, stiffness: 160}});
  const bubOp  = interpolate(frame, [62, 76], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const bubScale = interpolate(bubSp, [0, 1], [0.2, 1]);
  // Fade everything out with questions
  const bubbleGroupOp = showBubble
    ? 1
    : interpolate(frame, [140, 162], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  // Total SVG height = ABOVE_H + 5 visible mascot rows
  const SVG_W = 18 * PW;           // 216
  const SVG_H = ABOVE_H + 5 * PH;  // 110 + 110 = 220

  return (
    <div
      style={{
        transform: `scale(${scale}) translateY(${bob}px)`,
        opacity,
        transformOrigin: 'center bottom',
      }}
    >
      {/* Soft glow */}
      <div
        style={{
          position: 'absolute',
          inset: -24,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(215,119,87,0.22) 0%, transparent 68%)',
        }}
      />
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 ${-ABOVE_H} ${SVG_W} ${SVG_H}`}
        style={{display: 'block'}}
        shapeRendering="crispEdges"
      >
        {/* ── Thought bubble (above head) ── */}
        <g opacity={bubbleGroupOp}>
          {/* Dot 1 */}
          <rect
            x={DOT1.x} y={DOT1.y}
            width={DOT1.s} height={DOT1.s}
            fill={C} opacity={dot1Op}
          />
          {/* Dot 2 */}
          <rect
            x={DOT2.x} y={DOT2.y}
            width={DOT2.s} height={DOT2.s}
            fill={C} opacity={dot2Op}
          />
          {/* Dot 3 */}
          <rect
            x={DOT3.x} y={DOT3.y}
            width={DOT3.s} height={DOT3.s}
            fill={C} opacity={dot3Op}
          />
          {/* Main bubble — spring scale from its centre */}
          <g
            opacity={bubOp}
            style={{
              transform: `translate(${BUB_CX}px, ${BUB_CY}px) scale(${bubScale}) translate(${-BUB_CX}px, ${-BUB_CY}px)`,
            }}
          >
            <rect
              x={BUB.x} y={BUB.y}
              width={BUB.w} height={BUB.h}
              rx={BUB.rx} fill={C}
            />
            {/* "?" in white — pixel-art style using rects */}
            {/* top arc of ? */}
            <rect x={BUB_CX - 8} y={BUB.y + 10} width={16} height={4} fill="#fff" />
            <rect x={BUB_CX + 4}  y={BUB.y + 14} width={4}  height={6} fill="#fff" />
            <rect x={BUB_CX}      y={BUB.y + 20} width={4}  height={4} fill="#fff" />
            <rect x={BUB_CX - 4}  y={BUB.y + 24} width={4}  height={4} fill="#fff" />
            {/* stem gap */}
            {/* dot */}
            <rect x={BUB_CX - 2}  y={BUB.y + 34} width={4}  height={4} fill="#fff" />
          </g>
        </g>

        {/* ── row 0: head top (cols 3-14) ── */}
        <rect x={3 * PW} y={0} width={12 * PW} height={PH} fill={C} />

        {/* ── row 1: head bottom ── */}
        {armsUp ? (
          <>
            <rect x={1 * PW} y={PH} width={4 * PW} height={PH} fill={C} />
            <rect x={6 * PW} y={PH} width={6 * PW} height={PH} fill={C} />
            <rect x={13 * PW} y={PH} width={4 * PW} height={PH} fill={C} />
          </>
        ) : (
          <>
            <rect x={3 * PW} y={PH} width={2 * PW} height={PH} fill={C} />
            <rect x={6 * PW} y={PH} width={6 * PW} height={PH} fill={C} />
            <rect x={13 * PW} y={PH} width={2 * PW} height={PH} fill={C} />
          </>
        )}

        {/* ── row 2: body top ── */}
        {armsUp ? (
          <rect x={2 * PW} y={2 * PH} width={14 * PW} height={PH} fill={C} />
        ) : (
          <rect x={1 * PW} y={2 * PH} width={16 * PW} height={PH} fill={C} />
        )}

        {/* ── row 3: body bottom (cols 3-14) ── */}
        <rect x={3 * PW} y={3 * PH} width={12 * PW} height={PH} fill={C} />

        {/* ── row 4: feet (cols 4, 6, 11, 13) ── */}
        <rect x={4 * PW} y={4 * PH} width={PW} height={PH} fill={C} />
        <rect x={6 * PW} y={4 * PH} width={PW} height={PH} fill={C} />
        <rect x={11 * PW} y={4 * PH} width={PW} height={PH} fill={C} />
        <rect x={13 * PW} y={4 * PH} width={PW} height={PH} fill={C} />
      </svg>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────────

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Scene opacity: fade in 0→15, fade out 255→270
  const sceneOpacity = interpolate(frame, [0, 15, 255, 270], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Mascot spring entrance
  const mascotSpring = spring({frame: frame - 8, fps, config: {damping: 14, stiffness: 140}});
  const mascotOpacity = interpolate(frame, [8, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const mascotScale = interpolate(mascotSpring, [0, 1], [0.3, 1]);

  // Gentle idle bob
  const mascotBob = Math.sin((frame / fps) * Math.PI * 1.8) * 5;

  // arms-up when tagline reveals (frame 172+), and a quick flash at question 4 (frame 106)
  const armsUp = frame >= 172 || (frame >= 106 && frame < 118);

  // Questions: fade+slide out
  const questionsOpacity = interpolate(frame, [135, 165], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // "qrec remembers." tagline
  const taglineSpring = spring({frame: frame - 172, fps, config: {damping: 200}});
  const taglineOpacity = interpolate(frame, [172, 196], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const taglineY = interpolate(taglineSpring, [0, 1], [36, 0]);

  // Subtitle below tagline
  const subtitleOpacity = interpolate(frame, [196, 220], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Label above questions
  const labelOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: '#ffffff',
        opacity: sceneOpacity,
        fontFamily: theme.sans,
        overflow: 'hidden',
      }}
    >
      {/* Decorative background circles */}
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'rgba(215,119,87,0.07)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'rgba(0,98,168,0.05)',
        }}
      />

      {/* ── Left panel: questions ── */}
      <div
        style={{
          position: 'absolute',
          left: 72,
          top: 0,
          bottom: 0,
          width: 620,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 14,
          opacity: questionsOpacity,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: theme.textMuted,
            letterSpacing: 1.8,
            textTransform: 'uppercase',
            marginBottom: 4,
            opacity: labelOpacity,
          }}
        >
          If you find yourself asking yourself and Claude Code these questions...
        </div>

        {questions.map((q, i) => {
          const qSpring = spring({
            frame: frame - q.startFrame,
            fps,
            config: {damping: 200},
          });
          const qOpacity = interpolate(
            frame,
            [q.startFrame, q.startFrame + 14],
            [0, 1],
            {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
          );
          const qX = interpolate(qSpring, [0, 1], [-50, 0]);
          const isBlue = i % 2 !== 0;

          return (
            <div
              key={q.text}
              style={{
                opacity: qOpacity,
                transform: `translateX(${qX}px)`,
                background: isBlue ? theme.blueLight : theme.bg2,
                border: `1px solid ${isBlue ? theme.blueBorder : theme.border}`,
                borderRadius: 14,
                padding: '13px 20px',
                fontSize: 19,
                fontWeight: 450,
                color: theme.text,
                letterSpacing: -0.2,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontSize: 16,
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: isBlue ? theme.blueBorder : theme.border,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                💬
              </span>
              {q.text}
            </div>
          );
        })}
      </div>

      {/* ── Right panel: Clawd mascot ── */}
      <div
        style={{
          position: 'absolute',
          right: 60,
          top: 0,
          bottom: 0,
          width: 340,
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
        />
        <div
          style={{
            marginTop: 16,
            fontSize: 13,
            fontWeight: 600,
            color: theme.textMuted,
            letterSpacing: 0.5,
            opacity: mascotOpacity,
          }}
        >
          Claude Code
        </div>
      </div>

      {/* Vertical divider */}
      <div
        style={{
          position: 'absolute',
          left: 730,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 1,
          height: interpolate(frame, [18, 45], [0, 340], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          background: `linear-gradient(to bottom, transparent, ${theme.border}, transparent)`,
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
            fontSize: 76,
            fontWeight: 800,
            letterSpacing: -3.5,
            color: theme.text,
            lineHeight: 1,
            textAlign: 'center',
          }}
        >
          qrec{' '}
          <span style={{color: theme.blue}}>remembers.</span>
        </div>

        <div
          style={{
            marginTop: 20,
            fontSize: 21,
            fontWeight: 400,
            color: theme.textMuted,
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
