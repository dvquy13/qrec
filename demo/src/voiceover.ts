import {staticFile} from 'remotion';
import {Input, ALL_FORMATS, UrlSource} from 'mediabunny';

export const SCENE_IDS = [
  'opening',
  'onboard',
  'project-filter',
  'enrich-detail',
  'search-demo',
  'closing',
] as const;

export type SceneId = (typeof SCENE_IDS)[number];

export const sceneAudioFile = (id: SceneId | string): string =>
  staticFile(`voiceover/${id}.mp3`);

export const getAudioDuration = async (src: string): Promise<number> => {
  const input = new Input({
    formats: ALL_FORMATS,
    source: new UrlSource(src, {getRetryDelay: () => null}),
  });
  return input.computeDuration();
};
