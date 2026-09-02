import {DeviceEventEmitter, NativeModules, requireNativeComponent} from 'react-native';
import type {HostComponent, NativeSyntheticEvent, ViewProps} from 'react-native';

export type RepayOption = 'full' | 'minimum' | 'custom';
export type AgenUIAction = {call: 'selectRepayOption'; args: {type: RepayOption}};
export type AgenUISurfaceSizeEvent = {height: number};
export type AgenUISurfaceProps = ViewProps & {
  surfaceId: string;
  onSurfaceSizeChanged?: (event: NativeSyntheticEvent<AgenUISurfaceSizeEvent>) => void;
};

export const AgenUISurface: HostComponent<AgenUISurfaceProps> = requireNativeComponent('AgenUISurface');
export const agenuiBridge = NativeModules.AGenUIChatBridge as {
  receiveTextChunk(surfaceId: string, json: string): void;
  destroySurface(surfaceId: string): void;
  showSelectionAlert(message: string): void;
};
export const agenuiEvents = DeviceEventEmitter;
