import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_BOUNCY, SPRING_CRISP, getTyped, cursorBlink} from '../animUtils';
import {ClawdMascot} from '../components/ClawdMascot';
import {QrecLogo} from '../components/QrecLogo';

const CLAWD_ORANGE = '#D77757';

interface OpeningProps {
  showLogo?: boolean;
}

const QUESTIONS = [
  {text: 'What was I working on last week?', startFrame: 28},
  {text: 'Have we solved this problem before?', startFrame: 86},
];

// CHARS_PER_FRAME uses animUtils default (1.4)

// ── Clawd arm position geometry ──────────────────────────────────────────────
// ClawdMascot SVG: width=216, height=220, transformOrigin='center bottom'=(108,220)
// armsUp row 1 left arm:  div coords x=12 (left edge), center-y=143
// At scale S: visual_x = 108 + (x-108)*S,  visual_y = 220 + (y-220)*S
const armVisualPos = (scale: number) => ({
  x: 108 + (12 - 108) * scale,    // left arm LEFT edge (the "hand" tip)
  y: 220 + (143 - 220) * scale,   // arm center height
});

export const Opening: React.FC<OpeningProps> = ({showLogo}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  // Scene fade in 0→15, fade out 255→270
  const sceneOpacity = interpolate(frame, [0, 15, 255, 270], [0, 1, 1, 0], CLAMP);

  // ── Mascot entrance ──────────────────────────────────────────────────────
  const mascotSpring = spring({frame: frame - 8, fps, config: SPRING_BOUNCY});
  const mascotOpacity = interpolate(frame, [8, 28], [0, 1], CLAMP);
  const mascotScale = interpolate(mascotSpring, [0, 1], [0.3, 1]);
  const mascotBob = Math.sin((frame / fps) * Math.PI * 1.8) * 5;
  const armsUp = frame >= 172;
  // Reveal Clawd waves arms twice after logo lands (~frame 184), then stays up
  // Pattern: up 12f → down 12f → up 12f → down 12f → up permanently
  const revealArmsUp =
    (frame >= 184 && frame < 196) || // wave 1 up
    (frame >= 208 && frame < 220) || // wave 2 up
    frame >= 232;                    // settle up

  // ── Chapter heading ──────────────────────────────────────────────────────
  const headingOpacity = interpolate(frame, [6, 20], [0, 1], CLAMP);
  const headingSlide = interpolate(
    spring({frame: frame - 6, fps, config: SPRING_CRISP}),
    [0, 1],
    [-16, 0],
  );

  // ── Questions panel ──────────────────────────────────────────────────────
  const questionsOpacity = interpolate(frame, [130, 155], [1, 0], CLAMP);

  const blinkOn = cursorBlink(frame);

  // ── Tagline (default text-only path) ─────────────────────────────────────
  const taglineSpring = spring({frame: frame - 160, fps, config: SPRING_CRISP});
  const taglineOpacity = interpolate(frame, [160, 182], [0, 1], CLAMP);
  const taglineY = interpolate(taglineSpring, [0, 1], [36, 0]);
  const subtitleOpacity = interpolate(frame, [190, 212], [0, 1], CLAMP);

  // ── Logo reveal ──────────────────────────────────────────────────────────
  // Right-side mascot/label fades out as logo reveal starts
  const mascotRevealFade = showLogo
    ? interpolate(frame, [150, 170], [1, 0], CLAMP)
    : 1;

  // Reveal Clawd enters center-stage, arms up in excitement
  const revealClawdSp = spring({frame: frame - 158, fps, config: {damping: 12, stiffness: 160}});
  const revealClawdScale = interpolate(revealClawdSp, [0, 1], [0.4, 1.2]);
  const revealClawdOp = interpolate(frame, [158, 175], [0, 1], CLAMP);

  // Logo arcs in from the left, handle tip lands at Clawd's left hand
  // The SVG handle tip is at (484/512) of the logo size from top-left
  const LOGO_SIZE = 92;
  const REVEAL_SCALE = 1.2;
  const arm = armVisualPos(REVEAL_SCALE);   // visual left-arm tip in 216×220 parent div
  const handleFrac = 484 / 512;             // handle tip position as fraction of SVG size
  const handlePx = handleFrac * LOGO_SIZE;  // ~87px
  // Position logo so its handle tip sits exactly on Clawd's left hand
  const logoRestLeft = arm.x - handlePx;   // logo left edge
  const logoRestTop  = arm.y - handlePx;   // logo top edge

  const logoArcSp = spring({frame: frame - 163, fps, config: {damping: 11, stiffness: 140}});
  // Swings in from the left: starts offset left & slightly below, then springs to hand
  const logoOffsetX = interpolate(logoArcSp, [0, 1], [-140, 0]);
  const logoOffsetY = interpolate(logoArcSp, [0, 1], [30, 0]);
  const logoEnterScale = interpolate(logoArcSp, [0, 1], [0.3, 1]);
  const logoOp = interpolate(frame, [163, 180], [0, 1], CLAMP);

  // "qrec remembers." fades in after logo lands
  const revealTagOp = interpolate(frame, [192, 210], [0, 1], CLAMP);
  // tagline fades in last
  const revealSubOp = interpolate(frame, [208, 228], [0, 1], CLAMP);

  return (
    <AbsoluteFill
      style={{
        background: theme.blue,
        opacity: sceneOpacity,
        fontFamily: theme.sans,
        overflow: 'hidden',
      }}
    >
      {/* ── Questions phase ── */}
      <div style={{opacity: questionsOpacity}}>
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
            paddingTop: 100,
          }}
        >
          {QUESTIONS.map((q) => {
            const typed = getTyped(q.text, q.startFrame, frame);
            const isDone = typed.length >= q.text.length;
            const isActive = frame >= q.startFrame - 6;
            const qOpacity = interpolate(
              frame,
              [q.startFrame - 6, q.startFrame],
              [0, 1],
              CLAMP,
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

      {/* ── Right panel: Clawd (questions phase) ── */}
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
          opacity: mascotRevealFade,
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
        {/* "Your Claude Code" label fades with the mascot panel */}
        {!showLogo && (
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
        )}
      </div>

      {/* ── Vertical divider (questions phase only) ── */}
      <div
        style={{
          position: 'absolute',
          left: 740,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 1,
          height: interpolate(frame, [18, 45], [0, 300], CLAMP),
          background: 'linear-gradient(to bottom, transparent, rgba(255,255,255,0.2), transparent)',
          opacity: questionsOpacity,
        }}
      />

      {/* ── Tagline reveal ── */}
      {showLogo ? (
        /* ── Logo-in-hand variant ── */
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: taglineOpacity,
          }}
        >
          {/* Clawd + logo unit — bob the whole thing together */}
          <div
            style={{
              position: 'relative',
              width: 216,
              height: 220,
              overflow: 'visible',
              transform: `translateY(${mascotBob}px)`,
              marginBottom: 52,
            }}
          >
            {/* Reveal Clawd — arms up, excited */}
            <ClawdMascot
              scale={revealClawdScale}
              opacity={revealClawdOp}
              bob={0}
              armsUp={revealArmsUp}
              frame={frame}
              fps={fps}
              color="#ffffff"
            />

            {/* qrec logo — white on blue, positioned at Clawd's right hand */}
            <div
              style={{
                position: 'absolute',
                top: logoRestTop,
                left: logoRestLeft,
                opacity: logoOp,
                transform: `translate(${logoOffsetX}px, ${logoOffsetY}px) scale(${logoEnterScale})`,
                // Scale from the handle tip (bottom-right of SVG) so the hand contact stays fixed
                transformOrigin: 'right bottom',
              }}
            >
              <QrecLogo size={LOGO_SIZE} colorScheme="onBlue" />
            </div>
          </div>

          {/* "qrec remembers." — all white */}
          <div
            style={{
              fontSize: 66,
              fontWeight: 800,
              letterSpacing: -3,
              color: '#ffffff',
              lineHeight: 1,
              textAlign: 'center',
              opacity: revealTagOp,
            }}
          >
            qrec remembers.
          </div>

          {/* Tagline */}
          <div
            style={{
              marginTop: 18,
              fontSize: 20,
              fontWeight: 400,
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: -0.3,
              textAlign: 'center',
              opacity: revealSubOp,
            }}
          >
            Total recall for Claude Code — yours and Claude's.
          </div>
        </div>
      ) : (
        /* ── Default text-only tagline ── */
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
            Total recall for Claude Code — yours and Claude's.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
