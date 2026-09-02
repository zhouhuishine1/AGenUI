package com.amap.agenuirndemo;

import android.graphics.Color;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.fluid.afm.markdown.widget.PrinterMarkDownTextView;
import com.fluid.afm.styles.MarkdownStyles;

public final class FluidMarkdownViewManager extends SimpleViewManager<PrinterMarkDownTextView> {
  @Override public String getName() { return "FluidMarkdown"; }

  @Override protected PrinterMarkDownTextView createViewInstance(ThemedReactContext context) {
    PrinterMarkDownTextView view = new PrinterMarkDownTextView(context);
    view.init(MarkdownStyles.getDefaultStyles(), null);
    view.setTextColor(Color.rgb(29, 33, 41));
    view.setTextSize(16);
    view.setLineSpacing(0, 1.35f);
    return view;
  }

  @ReactProp(name = "markdown") public void setMarkdown(PrinterMarkDownTextView view, String markdown) {
    view.setMarkdownText(markdown == null ? "" : markdown);
    view.requestLayout();
    view.invalidate();
  }
}
