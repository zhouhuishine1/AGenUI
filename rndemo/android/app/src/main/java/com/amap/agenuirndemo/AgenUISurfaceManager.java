package com.amap.agenuirndemo;

import android.app.Activity;
import android.util.Log;
import android.view.ViewGroup;
import android.view.View;
import android.widget.FrameLayout;
import com.amap.agenui.render.surface.ISurfaceManagerListener;
import com.amap.agenui.render.surface.Surface;
import com.amap.agenui.render.surface.SurfaceManager;
import com.amap.agenui.render.surface.SurfaceSize;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.MapBuilder;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class AgenUISurfaceManager extends SimpleViewManager<AgenUISurfaceManager.SurfaceHostLayout> {
  private static final Map<String, SurfaceHost> hosts = new HashMap<>();
  private static final Map<String, List<String>> pendingChunks = new HashMap<>();
  @Override public String getName() { return "AgenUISurface"; }
  @Override protected SurfaceHostLayout createViewInstance(ThemedReactContext context) { return new SurfaceHostLayout(context); }
  @ReactProp(name = "surfaceId") public void setSurfaceId(SurfaceHostLayout view, String surfaceId) {
    if (surfaceId == null || hosts.containsKey(surfaceId)) return;
    Activity activity = ((ThemedReactContext) view.getContext()).getCurrentActivity();
    if (activity == null) return;
    SurfaceHost host = new SurfaceHost(activity, view); hosts.put(surfaceId, host);
    List<String> chunks = pendingChunks.remove(surfaceId); if (chunks != null) for (String chunk : chunks) host.receive(chunk);
  }
  @Override public void onDropViewInstance(SurfaceHostLayout view) { super.onDropViewInstance(view); }
  static synchronized void receive(String surfaceId, String json) {
    SurfaceHost host = hosts.get(surfaceId);
    if (host == null) pendingChunks.computeIfAbsent(surfaceId, ignored -> new ArrayList<>()).add(json); else host.receive(json);
  }
  static synchronized void destroy(String surfaceId) { SurfaceHost host = hosts.remove(surfaceId); pendingChunks.remove(surfaceId); if (host != null) host.destroy(); }
  private static final class SurfaceHost implements ISurfaceManagerListener {
    private final SurfaceHostLayout view; private final SurfaceManager manager;
    private final List<String> waitingMessages = new ArrayList<>();
    private Surface surface;
    private volatile int widthPx;
    private boolean surfaceMounted;
    private int lastReportedHeight;
    SurfaceHost(Activity activity, SurfaceHostLayout view) {
      this.view = view;
      widthPx = view.getWidth();
      view.addOnLayoutChangeListener((changed, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
        int nextWidth = right - left;
        if (nextWidth != widthPx) lastReportedHeight = 0;
        widthPx = nextWidth;
        flushWhenMeasured();
        if (nextWidth > 0 && nextWidth != oldRight - oldLeft) view.post(this::layoutSurfaceRoot);
      });
      manager = new SurfaceManager(activity);
      manager.addListener(this);
    }
    synchronized void receive(String json) {
      if (widthPx <= 0 || (!surfaceMounted && !json.contains("\"createSurface\""))) {
        waitingMessages.add(json);
      } else {
        manager.receiveTextChunk(json);
      }
    }
    private synchronized void flushWhenMeasured() {
      if (widthPx <= 0 || !surfaceMounted || waitingMessages.isEmpty()) return;
      for (String message : waitingMessages) manager.receiveTextChunk(message);
      waitingMessages.clear();
    }
    void destroy() { manager.destroy(); }
    @Override public void onCreateSurface(Surface surface) {
      this.surface = surface;
      surface.setAnimationEnabled(false);
      if (view.getWindowToken() != null) mountSurface(); else view.post(this::mountSurface);
    }
    private void mountSurface() {
      if (surface == null) return;
      ViewGroup container = surface.getContainer();
      ViewGroup parent = container.getParent() instanceof ViewGroup ? (ViewGroup) container.getParent() : null;
      if (parent != null && parent != view) parent.removeView(container);
      if (container.getParent() == view) return;
      view.removeAllViews();
      FrameLayout.LayoutParams layoutParams = new FrameLayout.LayoutParams(
          FrameLayout.LayoutParams.MATCH_PARENT,
          FrameLayout.LayoutParams.WRAP_CONTENT,
          android.view.Gravity.TOP);
      container.setVisibility(android.view.View.VISIBLE);
      container.setAlpha(1f);
      view.addView(container, layoutParams);
      surfaceMounted = true;
      view.requestLayout();
      flushWhenMeasured();
      scheduleRootLayout(0);
    }
    private void scheduleRootLayout(int attempt) {
      view.postDelayed(() -> {
        layoutSurfaceRoot();
        if (attempt < 8 && surfaceMounted) scheduleRootLayout(attempt + 1);
      }, attempt == 0 ? 50 : 150);
    }
    private void layoutSurfaceRoot() {
      if (surface == null || view.getWidth() <= 0) return;
      ViewGroup container = surface.getContainer();
      if (container.getChildCount() == 0) return;
      View root = container.getChildAt(0);
      ViewGroup.LayoutParams params = root.getLayoutParams();
      if (params == null) return;
      params.width = view.getWidth();
      root.setLayoutParams(params);
      int width = view.getWidth();
      root.setVisibility(View.VISIBLE);
      root.setAlpha(1f);
      root.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
          View.MeasureSpec.makeMeasureSpec(0, View.MeasureSpec.UNSPECIFIED));
      root.layout(0, 0, width, root.getMeasuredHeight());
      int measuredHeight = root.getMeasuredHeight();
      if (measuredHeight > 0 && measuredHeight != lastReportedHeight) {
        lastReportedHeight = measuredHeight;
        WritableMap event = Arguments.createMap();
        event.putInt("height", measuredHeight);
        ((ThemedReactContext) view.getContext()).getJSModule(RCTEventEmitter.class)
            .receiveEvent(view.getId(), "topSurfaceSizeChanged", event);
      }
      container.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
          View.MeasureSpec.makeMeasureSpec(measuredHeight, View.MeasureSpec.EXACTLY));
      container.layout(0, 0, width, measuredHeight);
      Log.i("AgenUIRN", "surface-layout host=" + view.getWidth() + "x" + view.getHeight()
          + " container=" + container.getMeasuredWidth() + "x" + container.getMeasuredHeight()
          + " root=" + root.getMeasuredWidth() + "x" + root.getMeasuredHeight()
          + " rootVisibility=" + root.getVisibility());
      Log.i("AgenUIRN", "Laid out AGenUI root width=" + root.getMeasuredWidth() + " height=" + root.getMeasuredHeight());
      Log.i("AgenUIRN", "Laid out root=" + root.getMeasuredWidth() + "x" + root.getMeasuredHeight()
          + " container=" + container.getMeasuredWidth() + "x" + container.getMeasuredHeight());
    }
    @Override public void onDeleteSurface(Surface surface) { view.post(view::removeAllViews); }
    @Override public void onReceiveActionEvent(String event) { }
    @Override public void onRootComponentUpdate(Surface surface, Map<String, String> props) {
      view.post(this::layoutSurfaceRoot);
    }
    @Override public void onError(Surface surface, int code, String message) { }
    @Override public void onBlankCheckResult(Surface surface, boolean isBlank) { }
    @Override public void onComponentAppeared(Surface surface, String id, String type, Map<String, Object> props) { }
    @Override public SurfaceSize surfaceSize(String surfaceId) { return widthPx > 0 ? new SurfaceSize(widthPx, 0) : null; }
  }

  @Override public Map<String, Object> getExportedCustomBubblingEventTypeConstants() {
    return MapBuilder.<String, Object>builder()
        .put("topSurfaceSizeChanged", MapBuilder.of("phasedRegistrationNames", MapBuilder.of("bubbled", "onSurfaceSizeChanged")))
        .build();
  }

  static final class SurfaceHostLayout extends FrameLayout {
    SurfaceHostLayout(ThemedReactContext context) { super(context); }
    @Override protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
      super.onMeasure(widthMeasureSpec, heightMeasureSpec);
      int width = getMeasuredWidth();
      int height = getMeasuredHeight();
      for (int index = 0; index < getChildCount(); index++) {
        View child = getChildAt(index);
        ViewGroup.LayoutParams params = child.getLayoutParams();
        params.width = width;
        child.setLayoutParams(params);
        child.measure(MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
            MeasureSpec.makeMeasureSpec(height, MeasureSpec.AT_MOST));
      }
      setMeasuredDimension(width, Math.max(1, height));
    }

    @Override protected void onLayout(boolean changed, int left, int top, int right, int bottom) {
      for (int index = 0; index < getChildCount(); index++) {
        getChildAt(index).layout(0, 0, right - left, bottom - top);
      }
    }
  }
}
