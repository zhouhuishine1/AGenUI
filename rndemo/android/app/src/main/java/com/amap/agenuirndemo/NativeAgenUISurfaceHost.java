package com.amap.agenuirndemo;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import com.amap.agenui.render.surface.ISurfaceManagerListener;
import com.amap.agenui.render.surface.Surface;
import com.amap.agenui.render.surface.SurfaceManager;
import com.amap.agenui.render.surface.SurfaceSize;
import java.util.Map;

public final class NativeAgenUISurfaceHost extends FrameLayout implements ISurfaceManagerListener {
  private final SurfaceManager manager;
  private Surface surface;
  public NativeAgenUISurfaceHost(Activity activity) { super(activity); manager = new SurfaceManager(activity); manager.addListener(this); }
  public void receive(String json) { manager.receiveTextChunk(json); }
  public void destroy() { manager.destroy(); }
  @Override public void onCreateSurface(Surface value) { surface = value; value.setAnimationEnabled(false); post(this::mount); }
  private void mount() { if (surface == null) return; ViewGroup container = surface.getContainer(); if (container.getParent() instanceof ViewGroup) ((ViewGroup) container.getParent()).removeView(container); removeAllViews(); addView(container, new LayoutParams(-1, -2)); requestLayout(); }
  @Override protected void onMeasure(int widthSpec, int heightSpec) { super.onMeasure(widthSpec, heightSpec); if (getChildCount() == 0) return; View child = getChildAt(0); child.measure(MeasureSpec.makeMeasureSpec(getMeasuredWidth(), MeasureSpec.EXACTLY), MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)); setMeasuredDimension(getMeasuredWidth(), Math.max(1, child.getMeasuredHeight())); }
  @Override protected void onLayout(boolean changed, int l, int t, int r, int b) { if (getChildCount() > 0) getChildAt(0).layout(0, 0, r - l, b - t); }
  @Override public void onDeleteSurface(Surface value) { removeAllViews(); }
  @Override public void onReceiveActionEvent(String event) { }
  @Override public void onRootComponentUpdate(Surface value, Map<String, String> props) { requestLayout(); }
  @Override public void onError(Surface value, int code, String message) { }
  @Override public void onBlankCheckResult(Surface value, boolean blank) { }
  @Override public void onComponentAppeared(Surface value, String id, String type, Map<String, Object> props) { }
  @Override public SurfaceSize surfaceSize(String id) { return getWidth() > 0 ? new SurfaceSize(getWidth(), 0) : null; }
}
