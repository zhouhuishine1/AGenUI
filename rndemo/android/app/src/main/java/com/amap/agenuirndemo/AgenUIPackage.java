package com.amap.agenuirndemo;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;
import java.util.Arrays;
import java.util.List;

public final class AgenUIPackage implements ReactPackage {
  @Override public List<NativeModule> createNativeModules(ReactApplicationContext context) { return Arrays.asList(new AgenUIChatBridge(context)); }
  @Override public List<ViewManager> createViewManagers(ReactApplicationContext context) { return Arrays.asList(new AgenUISurfaceManager(), new FluidMarkdownViewManager()); }
}
