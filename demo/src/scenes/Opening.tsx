import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {theme} from '../theme';
import {CLAMP, SPRING_BOUNCY, SPRING_SNAPPY, getTyped, cursorBlink} from '../animUtils';
import {QrecLogo} from '../components/QrecLogo';
import {ClawdMascot} from '../components/ClawdMascot';

// ── ClawdMascot clip constants ────────────────────────────────────────────────
// Body visual size at MASCOT_SCALE: 216*S wide × 110*S tall, bottom-aligned.
const MASCOT_SCALE = 0.4;
const CLIP_W = Math.round(216 * MASCOT_SCALE); // 86
const CLIP_H = Math.round(110 * MASCOT_SCALE); // 44

// ── Card data — styled after real `claude` CLI session startup ────────────────
const CARDS = [
  {title: 'fix search pagination crash',    path: '~/qrec',      effort: 'high effort'},
  {title: 'debug CUDA enricher segfault',   path: '~/qrec',      effort: 'max effort'},
  {title: 'add project heatmap filter',     path: '~/ui-kit',    effort: 'medium effort'},
  {title: 'refactor server lifecycle',      path: '~/qrec',      effort: 'high effort'},
  {title: 'first-run onboarding flow',      path: '~/qrec',      effort: 'medium effort'},
  {title: 'design system token audit',      path: '~/dashboard', effort: 'low effort'},
  {title: 'write eval pipeline docs',       path: '~/qrec',      effort: 'medium effort'},
  {title: 'animate Clawd mascot scenes',    path: '~/qrec',      effort: 'high effort'},
  {title: 'session detail markdown render', path: '~/ui-kit',    effort: 'medium effort'},
  {title: 'port runtime to Bun 1.3.10',    path: '~/qrec',      effort: 'low effort'},
];

const CARD_W = 320;
const CARD_H = 76;

// ── Animation timeline ────────────────────────────────────────────────────────
//  0– 8f  fade in
//  8–52f  10 cards cascade in from edges
// 52–65f  brief settle pause
// 65–73f  white question box slides in
// 73–118f typing "Too many Claude Code sessions burying valuable know-hows?"
// 118–135f hold/cursor blink
// 135–148f question box fades out
// 142–162f logo springs in
// 158–173f "Meet qrec." fades in
// 165–200f cards organize → stacked deck under logo
// 200–210f fade out

const TYPING_TEXT = 'Too many Claude Code sessions\nburying valuable know-hows?';
const TYPE_START  = 73;
const TYPE_SPEED  = 1.2; // chars/frame

// Entry stagger: 8, 12, 16, ..., 44
const ENTRY_FRAMES = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44];

// Off-screen from-positions
const FROM_POSITIONS: [number, number][] = [
  [-380, -80],
  [1400, -80],
  [-380, 308],
  [1400, 248],
  [-380, 614],
  [1400, 614],
  [370,  -220],
  [560,   900],
  [-380, 432],
  [1400, 400],
];

// Pile resting positions — spread across full 1280×720 canvas
const PILE_POSITIONS: [number, number][] = [
  [28,   28],
  [930,  24],
  [20,  302],
  [938, 242],
  [24,  606],
  [936, 604],
  [376,  16],
  [566, 622],
  [164, 438],
  [800, 410],
];

const PILE_ROTATIONS = [-8, 6, -12, 9, -5, 7, -10, 4, -15, 11];

// Organized: stacked deck below "Meet qrec." tagline
// Logo ~265, tagline ~338 (52px text → bottom ~390), stack starts at 470 for clear gap.
// Card i=9 (highest z-index) is the front/top card in the visual stack.
const STACK_X   = 640 - CARD_W / 2; // 480 — horizontally centered
const STACK_Y   = 470;               // top of front card — well below tagline
const STACK_DEPTH = 5;               // px per card going "back"

// Rotation of each card in the deck (slight alternating fan)
const STACK_ROTATIONS = [1.2, -0.8, 1.6, -1.0, 0.6, -1.4, 0.9, -0.5, 1.1, 0];

const CENTER_X = 640;
const CENTER_Y = 360;

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames}  = useVideoConfig();

  // ── Scene fade in/out ─────────────────────────────────────────────────────
  const sceneOpacity = interpolate(
    frame,
    [0, 8, durationInFrames - 13, durationInFrames],
    [0, 1, 1, 0],
    CLAMP,
  );

  // ── Question box ──────────────────────────────────────────────────────────
  const boxSlide   = spring({frame: frame - 65, fps, config: SPRING_SNAPPY});
  const boxOpacity = interpolate(frame, [65, 73, 135, 148], [0, 1, 1, 0], CLAMP);
  const boxY       = interpolate(boxSlide, [0, 1], [24, 0]);
  const typed      = getTyped(TYPING_TEXT, TYPE_START, frame, TYPE_SPEED);
  const blinkOn    = cursorBlink(frame);
  const typingDone = typed.length >= TYPING_TEXT.length;
  const showCursor = frame >= TYPE_START && frame < 148 && (typingDone ? blinkOn : true);

  // ── qrec logo springs in at frame 142 ────────────────────────────────────
  const logoSp      = spring({frame: frame - 142, fps, config: SPRING_BOUNCY});
  const logoScale   = interpolate(logoSp, [0, 1], [0, 1]);
  const logoOpacity = interpolate(frame, [142, 155], [0, 1], CLAMP);

  // ── "Meet qrec." fades in 158→173 ────────────────────────────────────────
  const taglineOpacity = interpolate(frame, [158, 173], [0, 1], CLAMP);

  // ── Cards dim while question is shown, brighten as they organize ──────────
  const cardDim = interpolate(frame, [68, 78, 155, 170], [1, 0.45, 0.45, 0.85], CLAMP);

  // ── Sonar rings — expand & fade after logo lands (frame 158) ─────────────
  // 3 rings staggered 17f apart. Each cycles over 50f: scale 1→2.5, opacity 0.45→0.
  const RING_PERIOD = 50;
  const RING_START  = 210; // last card settles ~frame 207, add 3f buffer
  const RING_PHASES = [0, 17, 34] as const;
  const rings = RING_PHASES.map((phase) => {
    if (frame < RING_START + phase) return {scale: 1, opacity: 0};
    const t = ((frame - RING_START - phase) % RING_PERIOD) / RING_PERIOD;
    return {scale: 1 + t * 1.5, opacity: 0.45 * (1 - t)};
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
      {/* ── Layer 1: Session cards ── */}
      {CARDS.map((card, i) => {
        const pileX = PILE_POSITIONS[i][0];
        const pileY = PILE_POSITIONS[i][1];

        // Entry: off-screen → scattered pile
        const entrySp    = spring({frame: frame - ENTRY_FRAMES[i], fps, config: SPRING_SNAPPY});
        const cardOpacity = interpolate(frame, [ENTRY_FRAMES[i], ENTRY_FRAMES[i] + 5], [0, 1], CLAMP);
        const entryX  = interpolate(entrySp, [0, 1], [FROM_POSITIONS[i][0], pileX]);
        const entryY  = interpolate(entrySp, [0, 1], [FROM_POSITIONS[i][1], pileY]);
        const entryRot = interpolate(entrySp, [0, 1], [0, PILE_ROTATIONS[i]]);

        // Organize: pile → stacked deck
        // Higher-index cards (higher z) are the "front" of the deck — they move first
        const orgDelay = 165 + (CARDS.length - 1 - i) * 3;
        const orgSp  = spring({frame: frame - orgDelay, fps, config: SPRING_SNAPPY});
        // Cards go deeper into the stack as index decreases (lower z = further back)
        const stackOffset = (CARDS.length - 1 - i) * STACK_DEPTH;
        const orgX   = interpolate(orgSp, [0, 1], [pileX, STACK_X]);
        const orgY   = interpolate(orgSp, [0, 1], [pileY, STACK_Y + stackOffset]);
        const orgRot = interpolate(orgSp, [0, 1], [PILE_ROTATIONS[i], STACK_ROTATIONS[i]]);

        const x   = frame >= orgDelay ? orgX   : entryX;
        const y   = frame >= orgDelay ? orgY   : entryY;
        const rot = frame >= orgDelay ? orgRot : entryRot;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: CARD_W,
              height: CARD_H,
              background: '#0d1117',
              borderRadius: 8,
              opacity: cardOpacity * cardDim,
              transform: `rotate(${rot}deg)`,
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              zIndex: i + 1,
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              gap: 14,
            }}
          >
            {/* Clawd mascot — clipped to body only */}
            <div
              style={{
                width: CLIP_W,
                height: CLIP_H,
                overflow: 'hidden',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                }}
              >
                <ClawdMascot
                  scale={MASCOT_SCALE}
                  opacity={1}
                  bob={0}
                  armsUp={false}
                  frame={0}
                  fps={30}
                  color="#D77757"
                />
              </div>
            </div>

            {/* Session info */}
            <div style={{flex: 1, overflow: 'hidden', minWidth: 0}}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#ffffff',
                  fontFamily: theme.mono,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {card.title}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.45)',
                  fontFamily: theme.mono,
                  marginTop: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                Sonnet 4.6 · {card.effort}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.28)',
                  fontFamily: theme.mono,
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                }}
              >
                {card.path}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Layer 2: Question text box ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, calc(-50% + ${boxY}px))`,
          opacity: boxOpacity,
          zIndex: 15,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: 16,
            padding: '36px 52px',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            // Fixed size — pre-sized to the full typed text so the box never expands
            width: 600,
            height: 166,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: '#0f172a',
              lineHeight: 1.35,
              letterSpacing: -0.8,
              whiteSpace: 'pre-line',
              overflow: 'hidden',
            }}
          >
            {typed}
            <span
              style={{
                opacity: showCursor ? 1 : 0,
                color: theme.blue,
                fontWeight: 300,
                marginLeft: 2,
              }}
            >
              |
            </span>
          </div>
        </div>
      </div>

      {/* ── Layer 5a: Sonar rings — radiate outward from logo center ── */}
      {rings.map((ring, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            // Circle center: cx=248,cy=248 in 512×512 SVG at size=128 → scene (638, 263).
            // Base size matches solid circle boundary: r=138/512*128 ≈ 35px → 70×70.
            left: 638 - 35,
            top: 263 - 35,
            width: 70,
            height: 70,
            borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.9)',
            transform: `scale(${ring.scale})`,
            opacity: ring.opacity,
            pointerEvents: 'none',
            zIndex: 30,
          }}
        />
      ))}

      {/* ── Layer 5b: qrec logo — upper center ── */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 265,
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          opacity: logoOpacity,
          zIndex: 31,
        }}
      >
        <QrecLogo size={128} colorScheme="onBlue" />
      </div>

      {/* ── Layer 6: "Meet qrec." tagline ── */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 338,
          textAlign: 'center',
          opacity: taglineOpacity,
          zIndex: 32,
        }}
      >
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            letterSpacing: -2.5,
            color: '#ffffff',
            lineHeight: 1,
          }}
        >
          Meet qrec.
        </div>
      </div>
    </AbsoluteFill>
  );
};
