package com.amap.agenuirndemo;

import android.app.Application;
import com.facebook.soloader.SoLoader;
import com.facebook.react.soloader.OpenSourceMergedSoMapping;
import com.amap.agenui.AGenUI;
import com.fluid.afm.AFMInitializer;
import com.facebook.react.ReactApplication;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.PackageList;
import com.facebook.react.ReactPackage;
import java.util.List;
import java.io.IOException;

public class MainApplication extends Application implements ReactApplication {
  private final ReactNativeHost reactNativeHost = new DefaultReactNativeHost(this) {
    @Override public boolean getUseDeveloperSupport() { return false; }
    @Override protected List<ReactPackage> getPackages() { List<ReactPackage> packages = new PackageList(this).getPackages(); packages.add(new AgenUIPackage()); return packages; }
    @Override protected String getJSMainModuleName() { return "index"; }
  };
  @Override public ReactNativeHost getReactNativeHost() { return reactNativeHost; }
  @Override public void onCreate() { super.onCreate(); try { SoLoader.init(this, OpenSourceMergedSoMapping.INSTANCE); } catch (IOException error) { throw new RuntimeException(error); } AFMInitializer.init(this, null, null, null); AGenUI.getInstance().initialize(getApplicationContext()); NativeFunctionRegistry.register(); }
}
