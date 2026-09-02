type A2uiContent = {
  updateComponents: {updateComponents: Record<string, unknown>};
  updateDataModel: {updateDataModel: Record<string, unknown>};
};

import {NativeModules} from 'react-native';
import questions from '../contents/index.json';
import defaultComponents from '../contents/账单还款/updateComponents.json';
import defaultDataModel from '../contents/账单还款/updateDataModel.json';
import defaultWeatherComponents from '../contents/天气/updateComponents.json';
import defaultWeatherDataModel from '../contents/天气/updateDataModel.json';

const contentsBridge = NativeModules.AGenUIChatBridge as {readContentsFile(path: string): Promise<string>};

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await contentsBridge.readContentsFile(path)) as T; } catch { return fallback; }
}

async function readOptionalJson<T>(path: string): Promise<T | undefined> {
  try { return JSON.parse(await contentsBridge.readContentsFile(path)) as T; } catch { return undefined; }
}

export async function loadQuestions() {
  return readJson('index.json', questions);
}

const contentLoaders: Record<string, () => A2uiContent> = {
  账单还款: () => ({
    updateComponents: defaultComponents,
    updateDataModel: defaultDataModel,
  }),
  天气: () => ({
    updateComponents: defaultWeatherComponents,
    updateDataModel: defaultWeatherDataModel,
  }),
};

export async function loadA2uiMessages(question: string, surfaceId: string) {
  const baseQuestion = question.startsWith('Tab') ? question.slice(3) : question;
  const defaults = contentLoaders[baseQuestion]?.();
  const folder = question;
  const fallbackFolder = baseQuestion;
  const runtimeComponents = await readOptionalJson<A2uiContent['updateComponents']>(`${folder}/updateComponents.json`)
    ?? (folder === fallbackFolder ? undefined : await readOptionalJson<A2uiContent['updateComponents']>(`${fallbackFolder}/updateComponents.json`));
  const runtimeDataModel = await readOptionalJson<A2uiContent['updateDataModel']>(`${folder}/updateDataModel.json`)
    ?? (folder === fallbackFolder ? undefined : await readOptionalJson<A2uiContent['updateDataModel']>(`${fallbackFolder}/updateDataModel.json`));
  if (!defaults && (!runtimeComponents || !runtimeDataModel)) return [];
  const content = {
    updateComponents: runtimeComponents ?? defaults!.updateComponents,
    updateDataModel: runtimeDataModel ?? defaults!.updateDataModel,
  };
  return [
    {version: 'v0.9', createSurface: {surfaceId, catalogId: 'https://a2ui.org/specification/v0_9/standard_catalog.json'}},
    {...content.updateComponents, updateComponents: {...content.updateComponents.updateComponents, surfaceId}},
    {...content.updateDataModel, updateDataModel: {...content.updateDataModel.updateDataModel, surfaceId}},
  ];
}
