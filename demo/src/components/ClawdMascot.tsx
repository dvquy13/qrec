import React from 'react';
import {interpolate, spring} from 'remotion';
import {theme} from '../theme';

// Clawd pixel mascot — reconstructed from claude binary.
// Grid: 18 sub-cols × 5 visible rows. viewBox adds ABOVE_H px above for thought bubble.
const PW = 12;
const PH = 22;
const ABOVE_H = 110;

// Thought bubble geometry (SVG coords, y negative = above mascot head)
const DOT1 = {x: 157, y: -16, s: 7};
const DOT2 = {x: 162, y: -40, s: 11};
const DOT3 = {x: 168, y: -66, s: 15};
const BUB = {x: 134, y: -108, w: 62, h: 46, rx: 6};
const BUB_CX = BUB.x + BUB.w / 2; // 165
const BUB_CY = BUB.y + BUB.h / 2; // -85

interface ClawdMascotProps {
  scale: number;
  opacity: number;
  /** Vertical offset in px (for idle bob animation) */
  bob: number;
  armsUp: boolean;
  frame: number;
  fps: number;
  /** Body fill color. '#D77757' (Clawd orange) or '#ffffff' (white). Default: orange. */
  color?: string;
  /** Color for the "?" mark inside the thought bubble. Derived from color if omitted. */
  markColor?: string;
  /** Show animated thought bubble above head. Default: false. */
  showThoughtBubble?: boolean;
}

export const ClawdMascot: React.FC<ClawdMascotProps> = ({
  scale,
  opacity,
  bob,
  armsUp,
  frame,
  fps,
  color = '#D77757',
  markColor,
  showThoughtBubble = false,
}) => {
  // Derive mark color: on white mascot the "?" should be the page background color
  const resolvedMarkColor = markColor ?? (color === '#ffffff' ? theme.blue : '#ffffff');

  // Glow ring matches the body color
  const glowRgb = color === '#ffffff' ? '255,255,255' : '215,119,87';

  // ── Thought bubble animation ─────────────────────────────────────────────
  const dot1Op = showThoughtBubble
    ? interpolate(frame, [30, 42], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const dot2Op = showThoughtBubble
    ? interpolate(frame, [42, 54], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const dot3Op = showThoughtBubble
    ? interpolate(frame, [54, 64], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const bubSp = showThoughtBubble
    ? spring({frame: frame - 62, fps, config: {damping: 10, stiffness: 160}})
    : 0;
  const bubOp = showThoughtBubble
    ? interpolate(frame, [62, 76], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
    : 0;
  const bubScale = interpolate(bubSp, [0, 1], [0.2, 1]);
  const bubbleGroupOp = !showThoughtBubble
    ? 0
    : frame < 140
      ? 1
      : interpolate(frame, [140, 162], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  const SVG_W = 18 * PW; // 216
  const SVG_H = ABOVE_H + 5 * PH; // 220

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
          background: `radial-gradient(circle, rgba(${glowRgb},0.22) 0%, transparent 68%)`,
        }}
      />

      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 ${-ABOVE_H} ${SVG_W} ${SVG_H}`}
        style={{display: 'block'}}
        shapeRendering="crispEdges"
      >
        {/* ── Thought bubble ── */}
        <g opacity={bubbleGroupOp}>
          <rect x={DOT1.x} y={DOT1.y} width={DOT1.s} height={DOT1.s} fill={color} opacity={dot1Op} />
          <rect x={DOT2.x} y={DOT2.y} width={DOT2.s} height={DOT2.s} fill={color} opacity={dot2Op} />
          <rect x={DOT3.x} y={DOT3.y} width={DOT3.s} height={DOT3.s} fill={color} opacity={dot3Op} />
          <g
            opacity={bubOp}
            style={{
              transform: `translate(${BUB_CX}px,${BUB_CY}px) scale(${bubScale}) translate(${-BUB_CX}px,${-BUB_CY}px)`,
            }}
          >
            <rect x={BUB.x} y={BUB.y} width={BUB.w} height={BUB.h} rx={BUB.rx} fill={color} />
            {/* "?" pixel art */}
            <rect x={BUB_CX - 8} y={BUB.y + 10} width={16} height={4} fill={resolvedMarkColor} />
            <rect x={BUB_CX + 4} y={BUB.y + 14} width={4} height={6} fill={resolvedMarkColor} />
            <rect x={BUB_CX} y={BUB.y + 20} width={4} height={4} fill={resolvedMarkColor} />
            <rect x={BUB_CX - 4} y={BUB.y + 24} width={4} height={4} fill={resolvedMarkColor} />
            <rect x={BUB_CX - 2} y={BUB.y + 34} width={4} height={4} fill={resolvedMarkColor} />
          </g>
        </g>

        {/* ── row 0: head top (cols 3-14) ── */}
        <rect x={3 * PW} y={0} width={12 * PW} height={PH} fill={color} />

        {/* ── row 1: head bottom (eyes = gaps at col 5 and 12) ── */}
        {armsUp ? (
          <>
            <rect x={1 * PW} y={PH} width={4 * PW} height={PH} fill={color} />
            <rect x={6 * PW} y={PH} width={6 * PW} height={PH} fill={color} />
            <rect x={13 * PW} y={PH} width={4 * PW} height={PH} fill={color} />
          </>
        ) : (
          <>
            <rect x={3 * PW} y={PH} width={2 * PW} height={PH} fill={color} />
            <rect x={6 * PW} y={PH} width={6 * PW} height={PH} fill={color} />
            <rect x={13 * PW} y={PH} width={2 * PW} height={PH} fill={color} />
          </>
        )}

        {/* ── row 2: body top ── */}
        {armsUp ? (
          <rect x={2 * PW} y={2 * PH} width={14 * PW} height={PH} fill={color} />
        ) : (
          <rect x={1 * PW} y={2 * PH} width={16 * PW} height={PH} fill={color} />
        )}

        {/* ── row 3: body bottom (cols 3-14) ── */}
        <rect x={3 * PW} y={3 * PH} width={12 * PW} height={PH} fill={color} />

        {/* ── row 4: feet (cols 4, 6, 11, 13) ── */}
        <rect x={4 * PW} y={4 * PH} width={PW} height={PH} fill={color} />
        <rect x={6 * PW} y={4 * PH} width={PW} height={PH} fill={color} />
        <rect x={11 * PW} y={4 * PH} width={PW} height={PH} fill={color} />
        <rect x={13 * PW} y={4 * PH} width={PW} height={PH} fill={color} />
      </svg>
    </div>
  );
};
