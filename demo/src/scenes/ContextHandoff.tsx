import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {CLAMP, getTyped, cursorBlink} from '../animUtils';
import {TrafficDots} from '../components/TrafficDots';
import {ClawdMascot} from '../components/ClawdMascot';

// ── Timeline (210f = 7s @ 30fps) ──────────────────────────────────────────────
//   0– 12f:  fade in — old session terminal with red statusline
//  12– 45f:  hold: viewer reads the 83% warning
//  45– 65f:  crossfade: old dims, new fades in
//  65– 80f:  new session settles (mascot + header)
//  80–140f:  user types "pick up context from the previous session"
// 140–158f:  ● Bash(qrec search ...) fades in
// 158–200f:  result lines stagger
// 200–210f:  fade out

const DURATION = 210;

// ClawdMascot geometry — transformOrigin:'center bottom' means the mascot body
// (head→feet) visually occupies layout-y 171–220 inside the 216×220px DOM box.
const MASCOT_SCALE = 0.45;
const MASCOT_LAYOUT_H = 220;
const MASCOT_VISIBLE_H = 49;
const MASCOT_CLIP_TOP = -(MASCOT_LAYOUT_H - MASCOT_VISIBLE_H); // -171

const USER_MSG = 'pick up context from the previous session';
const BASH_CMD = 'qrec search "session index migration" --k 5';

const RESULT_LINES = [
  'Decided on FTS5 + sqlite-vec for the session index',
  'after testing speed vs. BM25 alone.',
  'Migration in progress — chunks_vec created,',
  'backfill still pending.',
];

// Shared terminal chrome — used for both old and new session
const TerminalShell: React.FC<{title: string; children: React.ReactNode}> = ({title, children}) => (
  <div
    style={{
      width: 1000,
      borderRadius: 10,
      overflow: 'hidden',
      boxShadow: '0 20px 56px rgba(0,0,0,0.55)',
      fontFamily: theme.mono,
    }}
  >
    <div
      style={{
        background: '#ffffff',
        height: 46,
        display: 'flex',
        alignItems: 'center',
        padding: '0 18px',
        borderBottom: `1px solid ${theme.border}`,
      }}
    >
      <TrafficDots />
      <div
        style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 15,
          fontWeight: 500,
          color: theme.textMuted,
          fontFamily: theme.mono,
        }}
      >
        {title}
      </div>
      <div style={{width: 56}} />
    </div>
    <div
      style={{
        background: '#0d1117',
        padding: '24px 28px',
        minHeight: 280,
        fontSize: 18,
        lineHeight: 1.6,
      }}
    >
      {children}
    </div>
  </div>
);

// Red statusline widget — used in both terminals
const StatuslineCtx: React.FC = () => (
  <div
    style={{
      background: 'rgba(239,68,68,0.07)',
      border: '1px solid rgba(239,68,68,0.25)',
      borderRadius: 6,
      padding: '8px 14px',
      fontFamily: theme.mono,
      fontSize: 13,
      lineHeight: 1.7,
    }}
  >
    <div style={{color: 'rgba(255,255,255,0.45)'}}>
      <span style={{color: 'rgba(255,255,255,0.65)'}}>Sonnet 4.6</span>
      {'  📁 qrec · 🌿 main'}
    </div>
    <div>
      <span style={{color: 'rgba(255,255,255,0.45)'}}>Ctx </span>
      <span style={{color: '#ef4444', letterSpacing: 1}}>{'━━━━━━━━━━╌╌'}</span>
      <span style={{color: '#ef4444', fontWeight: 700}}>{' 83%'}</span>
      <span style={{color: '#fca5a5'}}>{' · ⚠ 2% more before truncation'}</span>
    </div>
  </div>
);

export const ContextHandoff: React.FC = () => {
  const frame = useCurrentFrame();
  const blinkOn = cursorBlink(frame);

  // ── Scene + crossfade opacities ───────────────────────────────────────────
  const sceneOpacity = interpolate(frame, [0, 12, DURATION - 10, DURATION], [0, 1, 1, 0], CLAMP);
  const oldOpacity = interpolate(frame, [45, 63], [1, 0], CLAMP);
  const newOpacity = interpolate(frame, [48, 68], [0, 1], CLAMP);

  // ── New session: typing ───────────────────────────────────────────────────
  const userMsg = getTyped(USER_MSG, 80, frame, 0.75);
  const userMsgDone = userMsg.length >= USER_MSG.length;

  // ── New session: tool call + results ─────────────────────────────────────
  const toolOpacity = interpolate(frame, [140, 155], [0, 1], CLAMP);

  const LINE_START = 158;
  const LINE_STAGGER = 11;
  const lineOpacities = RESULT_LINES.map((_, i) =>
    interpolate(frame, [LINE_START + i * LINE_STAGGER, LINE_START + i * LINE_STAGGER + 8], [0, 1], CLAMP),
  );

  return (
    <AbsoluteFill
      style={{background: theme.blue, fontFamily: theme.sans, overflow: 'hidden', opacity: sceneOpacity}}
    >
      {/* ── Old session terminal ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: oldOpacity,
        }}
      >
        <TerminalShell title="claude — db-migration-design">
          {/* Last assistant line — mid-work */}
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18}}>
            <span style={{color: theme.green, fontSize: 16}}>●</span>
            <span style={{color: 'rgba(255,255,255,0.5)', fontSize: 16}}>
              Write(<span style={{color: 'rgba(255,255,255,0.75)'}}>src/db.ts</span>)
              <span style={{color: 'rgba(255,255,255,0.35)'}}> · chunks_vec backfill in progress…</span>
            </span>
          </div>

          {/* Red statusline */}
          <StatuslineCtx />
        </TerminalShell>
      </div>

      {/* ── New session terminal ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: newOpacity,
        }}
      >
        <TerminalShell title="claude — new session">
          {/* Claude Code session header — mascot + version info */}
          <div style={{display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20}}>
            <div
              style={{
                width: 216,
                height: MASCOT_VISIBLE_H,
                overflow: 'hidden',
                flexShrink: 0,
                position: 'relative',
              }}
            >
              <div style={{position: 'absolute', top: MASCOT_CLIP_TOP}}>
                <ClawdMascot
                  scale={MASCOT_SCALE}
                  opacity={1}
                  bob={0}
                  armsUp={false}
                  frame={frame}
                  fps={30}
                />
              </div>
            </div>
            <div style={{paddingTop: 2}}>
              <div style={{color: '#ffffff', fontSize: 16, fontWeight: 600}}>Claude Code</div>
              <div style={{color: 'rgba(255,255,255,0.4)', fontSize: 14}}>
                Sonnet 4.6 · ~/frostmourne/qrec
              </div>
            </div>
          </div>

          {/* User message */}
          <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
            <span style={{color: theme.blue, fontWeight: 700}}>{'>'}</span>
            <span style={{color: '#ffffff'}}>
              {userMsg}
              {!userMsgDone && frame >= 80 && (
                <span style={{opacity: blinkOn ? 1 : 0, color: 'rgba(255,255,255,0.6)'}}>▌</span>
              )}
            </span>
          </div>

          {/* Tool call */}
          <div style={{opacity: toolOpacity, marginTop: 6}}>
            <div style={{display: 'flex', alignItems: 'baseline', gap: 8}}>
              <span style={{color: theme.green, fontSize: 16}}>●</span>
              <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 16}}>
                {'Bash('}
                <span style={{color: 'rgba(255,255,255,0.9)'}}>{BASH_CMD}</span>
                {')'}
              </span>
            </div>

            {/* Result lines */}
            <div style={{paddingLeft: 22, marginTop: 2}}>
              {RESULT_LINES.map((line, i) => (
                <div
                  key={i}
                  style={{opacity: lineOpacities[i], color: 'rgba(255,255,255,0.4)', fontSize: 16}}
                >
                  {i === 0 ? '└ ' : '  '}
                  {line}
                </div>
              ))}
            </div>
          </div>
        </TerminalShell>
      </div>
    </AbsoluteFill>
  );
};
