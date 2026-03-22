import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_SNAPPY} from '../animUtils';
import {ClawdMascot} from '../components/ClawdMascot';
import {QrecLogo} from '../components/QrecLogo';

// ── Clawd arm position geometry ───────────────────────────────────────────────
// ClawdMascot SVG: width=216, height=220, transformOrigin='center bottom'=(108,220)
// At scale S: visual_x = 108 + (x-108)*S,  visual_y = 220 + (y-220)*S
// armsUp:   row 1 left arm, x=12 (left edge), center-y=143
// armsDown: row 2 left arm, x=12 (left edge), center-y=165
const armVisualPos = (scale: number) => ({
  x: 108 + (12 - 108) * scale,
  y: 220 + (143 - 220) * scale,
});
const armVisualPosDown = (scale: number) => ({
  x: 108 + (12 - 108) * scale,
  y: 220 + (165 - 220) * scale,
});

// GitHub mark — official SVG path, rendered at given size/color
const GitHubMark: React.FC<{size: number; color: string}> = ({size, color}) => (
  <svg width={size} height={size} viewBox="0 0 98 96" fill="none">
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      fill={color}
    />
  </svg>
);

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  // Fade in 0→15, hold, fade out in last 12 frames
  const fadeOutStart = durationInFrames - 12;
  const sceneOpacity = interpolate(
    frame,
    [0, 15, fadeOutStart, durationInFrames],
    [0, 1, 1, 0],
    CLAMP,
  );

  const mascotBob = Math.sin((frame / fps) * Math.PI * 1.8) * 5;

  // ── Reveal Clawd — timeline compressed to fit 120f (scaled from 280f original) ──
  const revealClawdSp = spring({frame: frame - 13, fps, config: {damping: 12, stiffness: 160}});
  const revealClawdScale = interpolate(revealClawdSp, [0, 1], [0.4, 1.2]);
  const revealClawdOp = interpolate(frame, [13, 22], [0, 1], CLAMP);
  // Arms static until logo spring settles (~frame 50), then 2 up-down cycles, then settle
  const revealArmsUp =
    (frame >= 50 && frame < 58) || // wave 1 up
    (frame >= 66 && frame < 74) || // wave 2 up
    frame >= 82;                   // settle up

  // ── Logo arc ──────────────────────────────────────────────────────────────
  const LOGO_SIZE = 92;
  const handleFrac = 484 / 512; // SVG coords of magnifying glass leg tip / viewBox size
  const handlePx = handleFrac * LOGO_SIZE;

  // Live arm position — derived from current scale spring + arm state.
  // No fixed REVEAL_SCALE snapshot; logo tracks the arm frame-perfectly.
  const armNow = revealArmsUp
    ? armVisualPos(revealClawdScale)
    : armVisualPosDown(revealClawdScale);

  const logoArcSp = spring({frame: frame - 15, fps, config: {damping: 11, stiffness: 140}});
  const logoOffsetX = interpolate(logoArcSp, [0, 1], [-140, 0]);
  const logoOffsetY = interpolate(logoArcSp, [0, 1], [30, 0]);
  const logoEnterScale = interpolate(logoArcSp, [0, 1], [0.3, 1]);
  const logoOp = interpolate(frame, [15, 24], [0, 1], CLAMP);

  // ── CTA entrance — staggered spring slide-up ─────────────────────────────
  const installSp = spring({frame: frame - 8, fps, config: SPRING_SNAPPY});
  const installY = interpolate(installSp, [0, 1], [28, 0]);
  const installOp = interpolate(frame, [8, 20], [0, 1], CLAMP);

  const githubSp = spring({frame: frame - 18, fps, config: SPRING_SNAPPY});
  const githubY = interpolate(githubSp, [0, 1], [28, 0]);
  const githubOp = interpolate(frame, [18, 30], [0, 1], CLAMP);

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        opacity: sceneOpacity,
        fontFamily: theme.sans,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 32,
      }}
    >
      {/* Clawd + logo unit */}
      <div
        style={{
          position: 'relative',
          width: 216,
          height: 220,
          overflow: 'visible',
          transform: `translateY(${mascotBob}px)`,
        }}
      >
        <ClawdMascot
          scale={revealClawdScale}
          opacity={revealClawdOp}
          bob={0}
          armsUp={revealArmsUp}
          frame={frame}
          fps={fps}
          color="#D77757"
        />
        <div
          style={{
            position: 'absolute',
            top: armNow.y - handlePx,
            left: armNow.x - handlePx,
            opacity: logoOp,
            transform: `translate(${logoOffsetX}px, ${logoOffsetY}px) scale(${logoEnterScale})`,
            transformOrigin: 'right bottom',
          }}
        >
          <QrecLogo size={LOGO_SIZE} colorScheme="onBlue" />
        </div>
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 500,
          letterSpacing: -2.5,
          color: '#ffffff',
          lineHeight: 1.15,
          textAlign: 'center',
        }}
      >
        Total recall for Claude Code —<br />
        yours and Claude's. On-device.
      </div>

      {/* Install command — white pill, spring slide-up */}
      <div
        style={{
          opacity: installOp,
          transform: `translateY(${installY}px)`,
          background: '#ffffff',
          borderRadius: 10,
          padding: '14px 36px',
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.text,
          letterSpacing: 0.2,
        }}
      >
        $ npm install -g @dvquys/qrec
      </div>

      {/* GitHub URL — white pill, spring slide-up staggered */}
      <div
        style={{
          opacity: githubOp,
          transform: `translateY(${githubY}px)`,
          background: '#ffffff',
          borderRadius: 10,
          padding: '14px 36px',
          fontFamily: theme.mono,
          fontSize: 22,
          color: theme.text,
          letterSpacing: 0.2,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <GitHubMark size={22} color={theme.text} />
        github.com/dvquy13/qrec
      </div>
    </AbsoluteFill>
  );
};
