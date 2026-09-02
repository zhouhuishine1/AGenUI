package com.amap.agenuirndemo;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import com.facebook.react.ReactRootView;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

public final class RNFunctionRuntime {
  private static final long TIMEOUT_MS = 5000;
  private RNFunctionRuntime() {}

  public static String execute(String surfaceId, String call, String args) throws Exception {
    Activity activity = AgenUIChatBridge.getHostActivity();
    if (activity == null) throw new IllegalStateException("Activity unavailable");
    String requestId = UUID.randomUUID().toString();
    CountDownLatch latch = new CountDownLatch(1);
    FunctionCallRequests.put(requestId, latch);
    final String[] result = new String[1];
    FunctionCallRequests.results.put(requestId, result);
    final ReactRootView root = new ReactRootView(activity);
    final com.facebook.react.ReactInstanceManager instanceManager = ((MainApplication) activity.getApplication()).getReactNativeHost().getReactInstanceManager();
    Handler main = new Handler(Looper.getMainLooper());
    main.post(() -> {
      root.setVisibility(android.view.View.INVISIBLE);
      activity.addContentView(root, new android.view.ViewGroup.LayoutParams(1, 1));
      root.startReactApplication(instanceManager, "AgenUIFunctionRuntime", null);
      main.postDelayed(() -> emitWhenReady(requestId, surfaceId, call, args, main, 0), 100);
    });
    if (!latch.await(TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
      FunctionCallRequests.remove(requestId);
      main.post(() -> { root.unmountReactApplication(); instanceManager.destroy(); if (root.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) root.getParent()).removeView(root); });
      throw new IllegalStateException("Function call timed out");
    }
    String value = result[0];
    FunctionCallRequests.remove(requestId);
    main.post(() -> { root.unmountReactApplication(); instanceManager.destroy(); if (root.getParent() instanceof android.view.ViewGroup) ((android.view.ViewGroup) root.getParent()).removeView(root); });
    return value == null ? "{}" : value;
  }

  private static void emitWhenReady(String requestId, String surfaceId, String call, String args, Handler main, int attempt) {
    ReactContext context = ((MainApplication) AgenUIChatBridge.getHostActivity().getApplication()).getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
    if (context == null) { if (attempt < 50 && FunctionCallRequests.latches.containsKey(requestId)) main.postDelayed(() -> emitWhenReady(requestId, surfaceId, call, args, main, attempt + 1), 100); return; }
    WritableMap payload = Arguments.createMap();
    payload.putString("requestId", requestId); payload.putString("surfaceId", surfaceId); payload.putString("call", call); payload.putString("args", args);
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("RunFunctionCall", payload);
  }

  static final class FunctionCallRequests {
    static final java.util.Map<String, CountDownLatch> latches = new java.util.concurrent.ConcurrentHashMap<>();
    static final java.util.Map<String, String[]> results = new java.util.concurrent.ConcurrentHashMap<>();
    static void put(String id, CountDownLatch latch) { latches.put(id, latch); }
    static void complete(String id, String value) { String[] target = results.get(id); if (target != null) target[0] = value; CountDownLatch latch = latches.get(id); if (latch != null) latch.countDown(); }
    static void remove(String id) { latches.remove(id); results.remove(id); }
  }
}
