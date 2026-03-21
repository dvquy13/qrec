import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {theme} from '../theme';
import {SceneFade} from '../components/SceneFade';
import {BrowserFrame} from '../components/BrowserFrame';
import {SlideUp} from '../components/SlideUp';
import {SessionCard} from '../../../ui-react/src/components/SessionCard';
import {SESSIONS_BY_PROJECT} from '../data/index';

export const RecentSessions: React.FC = () => {
  const frame = useCurrentFrame();

  const qrecSession = SESSIONS_BY_PROJECT['qrec'][0];
  const apiSession = SESSIONS_BY_PROJECT['api'][0];
  const dashboardSession = SESSIONS_BY_PROJECT['dashboard'][0];

  // Progressive enrich reveal per card
  // Card 1 (startFrame 20): summary +30=50, full +60=80
  const card1Summary = frame >= 50;
  const card1Full = frame >= 80;

  // Card 2 (startFrame 45): summary +30=75, full +60=105
  const card2Summary = frame >= 75;
  const card2Full = frame >= 105;

  // Card 3 (startFrame 70): summary +30=100, full +60=130
  const card3Summary = frame >= 100;
  const card3Full = frame >= 130;

  const subtitleOpacity = interpolate(frame, [190, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <SceneFade durationInFrames={270} fadeIn={20} fadeOut={30}>
      <AbsoluteFill
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px 50px',
          fontFamily: theme.sans,
        }}
      >
        <BrowserFrame
          url="localhost:25927/sessions"
          style={{width: 900, height: 480}}
        >
          <div style={{padding: 20, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden'}}>
            <SlideUp start={20}>
              <SessionCard
                id={qrecSession.id}
                title={qrecSession.title}
                project={qrecSession.project}
                date={qrecSession.date}
                summary={qrecSession.summary}
                tags={qrecSession.tags}
                learnings={qrecSession.learnings}
                score={qrecSession.score}
                showSummary={card1Summary}
                showTags={card1Full}
                showLearnings={card1Full}
              />
            </SlideUp>
            <SlideUp start={45}>
              <SessionCard
                id={apiSession.id}
                title={apiSession.title}
                project={apiSession.project}
                date={apiSession.date}
                summary={apiSession.summary}
                tags={apiSession.tags}
                learnings={apiSession.learnings}
                score={apiSession.score}
                showSummary={card2Summary}
                showTags={card2Full}
                showLearnings={card2Full}
              />
            </SlideUp>
            <SlideUp start={70}>
              <SessionCard
                id={dashboardSession.id}
                title={dashboardSession.title}
                project={dashboardSession.project}
                date={dashboardSession.date}
                summary={dashboardSession.summary}
                tags={dashboardSession.tags}
                learnings={dashboardSession.learnings}
                score={dashboardSession.score}
                showSummary={card3Summary}
                showTags={card3Full}
                showLearnings={card3Full}
              />
            </SlideUp>
          </div>
        </BrowserFrame>

        {/* Subtitle */}
        {frame >= 190 && (
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
            Every session enriched with summaries, learnings, and tags.
          </div>
        )}
      </AbsoluteFill>
    </SceneFade>
  );
};
