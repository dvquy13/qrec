import React from 'react';
import {Composition} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import '../../ui-react/src/styles/variables.css';
import {QrecDemo} from './QrecDemo';
import {Opening} from './scenes/Opening';
import {Onboard} from './scenes/Onboard';
import {ProjectFilter} from './scenes/ProjectFilter';
import {EnrichDetail} from './scenes/EnrichDetail';
import {EnrichDetailV2} from './scenes/EnrichDetailV2';
import {EnrichDetailV5} from './scenes/EnrichDetailV5';

const OpeningLogo: React.FC = () => <Opening showLogo />;

loadFont({
  family: 'Google Sans Flex',
  url: staticFile('fonts/GoogleSansFlex-latin-ext.woff2'),
  weight: '100 900',
  display: 'block',
});

loadFont({
  family: 'Google Sans Flex',
  url: staticFile('fonts/GoogleSansFlex-latin.woff2'),
  weight: '100 900',
  display: 'block',
});

loadFont({
  family: 'Google Sans Code',
  url: staticFile('fonts/GoogleSansCode-VariableFont_wght.ttf'),
  weight: '100 900',
  display: 'block',
});

const globalStyles = `* { box-sizing: border-box; margin: 0; padding: 0; }`;

export const Root: React.FC = () => {
  return (
    <>
      <style>{globalStyles}</style>
      <Composition
        id="QrecDemo"
        component={QrecDemo}
        durationInFrames={2310}
        fps={30}
        width={1280}
        height={720}
      />
        <Composition
          id="OpeningLogo"
          component={OpeningLogo}
          durationInFrames={270}
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
        durationInFrames={230}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="EnrichDetailV2"
        component={EnrichDetailV2}
        durationInFrames={230}
        fps={30}
        width={1280}
        height={720}
      />
      <Composition
        id="EnrichDetailV5"
        component={EnrichDetailV5}
        durationInFrames={445}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
