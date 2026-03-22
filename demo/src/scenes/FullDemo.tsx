import React from 'react';
import {Series} from 'remotion';
import {Audio} from '@remotion/media';
import {Opening} from './Opening';
import {Onboard} from './Onboard';
import {ProjectFilter} from './ProjectFilter';
import {EnrichDetail} from './EnrichDetail';
import {SearchDemo} from './SearchDemo';
import {Closing} from './Closing';
import {SCENE_IDS, sceneAudioFile} from '../voiceover';

export const ORIGINAL_SCENE_DURATIONS = [250, 198, 180, 490, 310, 120] as const;

export interface FullDemoProps {
  sceneDurationsInFrames?: number[];
}

export const FullDemo: React.FC<FullDemoProps> = ({sceneDurationsInFrames}) => {
  const durations = ORIGINAL_SCENE_DURATIONS.map((orig, i) =>
    sceneDurationsInFrames
      ? Math.max(sceneDurationsInFrames[i] ?? orig, orig)
      : orig,
  );

  return (
    <Series>
      <Series.Sequence durationInFrames={durations[0]}>
        <Opening />
        <Audio src={sceneAudioFile(SCENE_IDS[0])} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={durations[1]}>
        <Onboard />
        <Audio src={sceneAudioFile(SCENE_IDS[1])} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={durations[2]}>
        <ProjectFilter />
        <Audio src={sceneAudioFile(SCENE_IDS[2])} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={durations[3]}>
        <EnrichDetail />
        <Audio src={sceneAudioFile(SCENE_IDS[3])} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={durations[4]}>
        <SearchDemo />
        <Audio src={sceneAudioFile(SCENE_IDS[4])} />
      </Series.Sequence>
      <Series.Sequence durationInFrames={durations[5]}>
        <Closing />
        <Audio src={sceneAudioFile(SCENE_IDS[5])} />
      </Series.Sequence>
    </Series>
  );
};
