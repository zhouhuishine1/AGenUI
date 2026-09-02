import React from 'react';
import {AppRegistry} from 'react-native';
import App from './src/App';
import {DeviceEventEmitter, NativeModules} from 'react-native';
import {name as appName} from './app.json';
AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('AgenUIFunctionRuntime', () => function Runtime() {
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('RunFunctionCall', payload => {
      const type = JSON.parse(payload.args).type;
      const message = type === 'full' ? '已选择全量还款' : type === 'minimum' ? '已选择先还最低' : '已选择自定义还款';
      NativeModules.AGenUIChatBridge.completeFunctionCall(payload.requestId, JSON.stringify({message}));
    });
    return () => subscription.remove();
  }, []);
  return null;
});
