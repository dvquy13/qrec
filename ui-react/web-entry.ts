import './src/styles/variables.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionCard, SessionCardProps } from './src/components/SessionCard';
import { HeatmapGrid, HeatmapGridProps } from './src/components/HeatmapGrid';
import { EnrichBlock, EnrichBlockProps } from './src/components/EnrichBlock';
import { HeatmapProjectFilter, HeatmapProjectFilterProps } from './src/components/HeatmapProjectFilter';
import { ActivityFeed, ActivityFeedProps } from './src/components/ActivityFeed';
import { DashboardSection, DashboardSectionProps } from './src/sections/DashboardSection';
import { RecentSessionsSection, RecentSessionsSectionProps } from './src/sections/RecentSessionsSection';
import { SessionsSection, SessionsSectionProps } from './src/sections/SessionsSection';
import { SessionDetailSection, SessionDetailSectionProps } from './src/sections/SessionDetailSection';

interface ElementWithRoot extends HTMLElement {
  __qrec_root__?: ReturnType<typeof ReactDOM.createRoot>;
}

function mount<P extends object>(Component: React.FC<P>, el: ElementWithRoot, props: P) {
  if (!el.__qrec_root__) el.__qrec_root__ = ReactDOM.createRoot(el);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  el.__qrec_root__.render(React.createElement(Component as any, props));
}

declare global {
  interface Window {
    QrecUI: {
      renderSessionCard: (el: HTMLElement, props: SessionCardProps) => void;
      renderHeatmapGrid: (el: HTMLElement, props: HeatmapGridProps) => void;
      renderEnrichBlock: (el: HTMLElement, props: EnrichBlockProps) => void;
      renderHeatmapProjectFilter: (el: HTMLElement, props: HeatmapProjectFilterProps) => void;
      renderActivityFeed: (el: HTMLElement, props: ActivityFeedProps) => void;
      renderDashboard: (el: HTMLElement, props: DashboardSectionProps) => void;
      renderRecentSessions: (el: HTMLElement, props: RecentSessionsSectionProps) => void;
      renderSessions: (el: HTMLElement, props: SessionsSectionProps) => void;
      renderSessionDetail: (el: HTMLElement, props: SessionDetailSectionProps) => void;
      unmount: (el: HTMLElement) => void;
    };
  }
}

window.QrecUI = {
  renderSessionCard: (el, props) => mount(SessionCard, el as ElementWithRoot, props),
  renderHeatmapGrid: (el, props) => mount(HeatmapGrid, el as ElementWithRoot, props),
  renderEnrichBlock: (el, props) => mount(EnrichBlock, el as ElementWithRoot, props),
  renderHeatmapProjectFilter: (el, props) => mount(HeatmapProjectFilter, el as ElementWithRoot, props),
  renderActivityFeed: (el, props) => mount(ActivityFeed, el as ElementWithRoot, props),
  renderDashboard: (el, props) => mount(DashboardSection, el as ElementWithRoot, props),
  renderRecentSessions: (el, props) => mount(RecentSessionsSection, el as ElementWithRoot, props),
  renderSessions: (el, props) => mount(SessionsSection, el as ElementWithRoot, props),
  renderSessionDetail: (el, props) => mount(SessionDetailSection, el as ElementWithRoot, props),
  unmount: (el) => {
    const e = el as ElementWithRoot;
    e.__qrec_root__?.unmount();
    delete e.__qrec_root__;
  },
};
