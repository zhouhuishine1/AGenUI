package com.amap.agenuirndemo;

import com.amap.agenui.AGenUI;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.app.AlertDialog;
import android.app.Activity;
import com.facebook.react.bridge.Promise;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public final class AgenUIChatBridge extends ReactContextBaseJavaModule {
  private static ReactApplicationContext reactContext;
  private static boolean functionRegistered;
  private static Activity hostActivity;
  public static void setHostActivity(Activity activity) { hostActivity = activity; }
  public static Activity getHostActivity() { return hostActivity; }
  public static void showSelectionAlertMessage(String message) {
    Activity activity = hostActivity;
    if (activity != null) activity.runOnUiThread(() -> new AlertDialog.Builder(activity).setTitle("还款方案").setMessage(message).setPositiveButton("知道了", null).show());
  }
  public AgenUIChatBridge(ReactApplicationContext context) { super(context); reactContext = context; }
  @Override public String getName() { return "AGenUIChatBridge"; }
  @ReactMethod public void receiveTextChunk(String surfaceId, String json) { AgenUISurfaceManager.receive(surfaceId, json); }
  @ReactMethod public void destroySurface(String surfaceId) { AgenUISurfaceManager.destroy(surfaceId); }
  @ReactMethod public void addListener(String eventName) { }
  @ReactMethod public void removeListeners(double count) { }
  @ReactMethod public void readContentsFile(String relativePath, Promise promise) {
    try {
      File root = getReactApplicationContext().getExternalFilesDir("contents");
      if (root == null) { promise.reject("CONTENTS_DIR", "Contents directory unavailable"); return; }
      File file = new File(root, relativePath);
      if (!file.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) {
        promise.reject("CONTENTS_PATH", "Invalid contents path"); return;
      }
      if (!file.isFile()) { promise.reject("CONTENTS_MISSING", "Contents file not found"); return; }
      promise.resolve(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
    } catch (Exception error) { promise.reject("CONTENTS_READ", error); }
  }
  @ReactMethod public void showSelectionAlert(String message) {
    Activity activity = hostActivity;
    if (activity != null) activity.runOnUiThread(() -> new AlertDialog.Builder(activity)
        .setTitle("还款方案").setMessage(message).setPositiveButton("知道了", null).show());
  }
  @ReactMethod public void completeFunctionCall(String requestId, String result) { RNFunctionRuntime.FunctionCallRequests.complete(requestId, result); }
}
