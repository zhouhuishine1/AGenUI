import {requireNativeComponent} from 'react-native';
import type {HostComponent, ViewProps} from 'react-native';

type FluidMarkdownProps = ViewProps & {markdown: string};

export const FluidMarkdown: HostComponent<FluidMarkdownProps> = requireNativeComponent('FluidMarkdown');
