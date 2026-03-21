import React from 'react';
import {Composition} from 'remotion';
import '../../ui-react/src/styles/variables.css';
import {QrecDemo} from './QrecDemo';

const fontFaces = `
  @font-face {
    font-family: 'Google Sans Flex';
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
    src: url('/fonts/GoogleSansFlex-latin-ext.woff2') format('woff2');
    unicode-range: U+0100-024F, U+0259, U+1E00-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: 'Google Sans Flex';
    font-style: normal;
    font-weight: 100 900;
    font-display: block;
    src: url('/fonts/GoogleSansFlex-latin.woff2') format('woff2');
  }
* { box-sizing: border-box; margin: 0; padding: 0; }
`;

export const Root: React.FC = () => {
  return (
    <>
      <style>{fontFaces}</style>
      <Composition
      id="QrecDemo"
      component={QrecDemo}
      durationInFrames={1500}
      fps={30}
      width={1280}
      height={720}
    />
    </>
  );
};
