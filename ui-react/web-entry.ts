import './src/styles/variables.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionCard, SessionCardProps } from './src/components/SessionCard';
import { HeatmapGrid, HeatmapGridProps } from './src/components/HeatmapGrid';
import { EnrichBlock, EnrichBlockProps } from './src/components/EnrichBlock';

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
      unmount: (el: HTMLElement) => void;
    };
  }
}

window.QrecUI = {
  renderSessionCard: (el, props) => mount(SessionCard, el as ElementWithRoot, props),
  renderHeatmapGrid: (el, props) => mount(HeatmapGrid, el as ElementWithRoot, props),
  renderEnrichBlock: (el, props) => mount(EnrichBlock, el as ElementWithRoot, props),
  unmount: (el) => {
    const e = el as ElementWithRoot;
    e.__qrec_root__?.unmount();
    delete e.__qrec_root__;
  },
};
