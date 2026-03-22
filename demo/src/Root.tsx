import React from 'react';
import {Composition, CalculateMetadataFunction} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import '../../ui-react/src/styles/variables.css';
import {Opening} from './scenes/Opening';
import {Onboard} from './scenes/Onboard';
import {ProjectFilter} from './scenes/ProjectFilter';
import {EnrichDetail} from './scenes/EnrichDetail';
import {SearchDemo} from './scenes/SearchDemo';
import {Closing} from './scenes/Closing';
import {FullDemo, FullDemoProps, ORIGINAL_SCENE_DURATIONS} from './scenes/FullDemo';
import {SCENE_IDS, sceneAudioFile, getAudioDuration} from './voiceover';

loadFont({
  family: 'Google Sans Flex',
  url: staticFile('fonts/GoogleSansFlex-latin-ext.woff2'),
  format: 'woff2',
  weight: '100 900',
  display: 'block',
});

loadFont({
  family: 'Google Sans Flex',
  url: staticFile('fonts/GoogleSansFlex-latin.woff2'),
  format: 'woff2',
  weight: '100 900',
  display: 'block',
});

loadFont({
  family: 'Google Sans Code',
  url: staticFile('fonts/GoogleSansCode-VariableFont_wght.ttf'),
  format: 'truetype',
  weight: '100 900',
  display: 'block',
});

const globalStyles = `* { box-sizing: border-box; margin: 0; padding: 0; }`;

const FPS = 30;

const calculateFullDemoMetadata: CalculateMetadataFunction<FullDemoProps> =
  async () => {
    try {
      const durations = await Promise.all(
        SCENE_IDS.map((id) => getAudioDuration(sceneAudioFile(id))),
      );
      const sceneDurationsInFrames = durations.map((secs, i) =>
        Math.max(Math.ceil(secs * FPS), ORIGINAL_SCENE_DURATIONS[i]),
      );
      return {
        durationInFrames: sceneDurationsInFrames.reduce((a, b) => a + b, 0),
        props: {sceneDurationsInFrames},
      };
    } catch {
      // Audio files not yet generated — fall back to original visual durations
      return {
        durationInFrames: ORIGINAL_SCENE_DURATIONS.reduce((a, b) => a + b, 0),
        props: {sceneDurationsInFrames: ORIGINAL_SCENE_DURATIONS},
      };
    }
  };

export const Root: React.FC = () => {
  return (
    <>
      <style>{globalStyles}</style>
      <Composition
          id="OpeningLogo"
          component={Opening}
          durationInFrames={250}
          fps={30}
          width={1280}
          height={720}
        />
      <Composition
        id="Onboard"
        component={Onboard}
        durationInFrames={198}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="ProjectFilter"
        component={ProjectFilter}
        durationInFrames={180}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="EnrichDetail"
        component={EnrichDetail}
        durationInFrames={490}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="SearchDemo"
        component={SearchDemo}
        durationInFrames={310}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="Closing"
        component={Closing}
        durationInFrames={120}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="FullDemo"
        component={FullDemo}
        durationInFrames={ORIGINAL_SCENE_DURATIONS.reduce((a, b) => a + b, 0)}
        fps={FPS}
        width={1280}
        height={720}
        defaultProps={{sceneDurationsInFrames: ORIGINAL_SCENE_DURATIONS}}
        calculateMetadata={calculateFullDemoMetadata}
      />
    </>
  );
};
