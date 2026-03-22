import React from 'react';
import {Composition} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';
import '../../ui-react/src/styles/variables.css';
import {Opening} from './scenes/Opening';
import {Onboard} from './scenes/Onboard';
import {ProjectFilter} from './scenes/ProjectFilter';
import {EnrichDetail} from './scenes/EnrichDetail';
import {SearchDemo} from './scenes/SearchDemo';
import {Closing} from './scenes/Closing';
import {FullDemo} from './scenes/FullDemo';

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
        durationInFrames={1649}
        fps={30}
        width={1280}
        height={720}
      />
    </>
  );
};
