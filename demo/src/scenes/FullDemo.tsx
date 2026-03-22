import React from 'react';
import {Series} from 'remotion';
import {Opening} from './Opening';
import {Onboard} from './Onboard';
import {ProjectFilter} from './ProjectFilter';
import {EnrichDetail} from './EnrichDetail';
import {SearchDemo} from './SearchDemo';
import {Closing} from './Closing';

export const FullDemo: React.FC = () => {
  return (
    <Series>
      <Series.Sequence durationInFrames={250}>
        <Opening />
      </Series.Sequence>
      <Series.Sequence durationInFrames={198}>
        <Onboard />
      </Series.Sequence>
      <Series.Sequence durationInFrames={180}>
        <ProjectFilter />
      </Series.Sequence>
      <Series.Sequence durationInFrames={490}>
        <EnrichDetail />
      </Series.Sequence>
      <Series.Sequence durationInFrames={310}>
        <SearchDemo />
      </Series.Sequence>
      <Series.Sequence durationInFrames={120}>
        <Closing />
      </Series.Sequence>
    </Series>
  );
};
