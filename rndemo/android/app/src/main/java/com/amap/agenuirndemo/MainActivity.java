package com.amap.agenuirndemo;

import android.app.Activity;
import android.os.Bundle;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.widget.*;
import com.fluid.afm.markdown.widget.PrinterMarkDownTextView;
import com.fluid.afm.styles.MarkdownStyles;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import org.json.*;

public final class MainActivity extends Activity {
  private LinearLayout messages;
  private LinearLayout faq;
  private JSONArray questions;
  @Override protected void onCreate(Bundle state) {
    super.onCreate(state); AgenUIChatBridge.setHostActivity(this); questions = readArray("index.json");
    messages = new LinearLayout(this); faq = new LinearLayout(this);
    LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.rgb(245,242,238));
    root.addView(header(), new LinearLayout.LayoutParams(-1, dp(56))); root.addView(todo(), new LinearLayout.LayoutParams(-1, -2));
    ScrollView chat = new ScrollView(this); messages.setOrientation(LinearLayout.VERTICAL); messages.setPadding(dp(12), dp(12), dp(12), dp(12)); chat.addView(messages); root.addView(chat, new LinearLayout.LayoutParams(-1, 0, 1));
    faq.setOrientation(LinearLayout.HORIZONTAL); faq.setPadding(dp(8), dp(4), dp(8), dp(4)); ScrollView faqScroll = new ScrollView(this); faqScroll.setHorizontalScrollBarEnabled(false); faqScroll.addView(faq); root.addView(faqScroll, new LinearLayout.LayoutParams(-1, dp(52)));
    LinearLayout composer = new LinearLayout(this); composer.setPadding(dp(12), dp(8), dp(12), dp(8)); EditText input = new EditText(this); input.setHint("请输入您要咨询的问题"); Button send = new Button(this); send.setText("发送"); send.setOnClickListener(v -> { submit(input.getText().toString(), chat); input.setText(""); }); composer.addView(input, new LinearLayout.LayoutParams(0, -2, 1)); composer.addView(send, new LinearLayout.LayoutParams(-2, -2)); root.addView(composer);
    setContentView(root); loadFaq(chat);
  }
  private View header() { TextView value = new TextView(this); value.setText("◷     权益       小安       账户       更多 ›"); value.setTextColor(Color.WHITE); value.setTextSize(16); value.setGravity(Gravity.CENTER_VERTICAL); value.setPadding(dp(20), 0, 0, 0); value.setBackgroundColor(Color.rgb(43,36,33)); return value; }
  private View todo() { TextView value = new TextView(this); value.setText("待办     今日待办 3 项                         展开⌄"); value.setTextColor(Color.rgb(84,42,25)); value.setTextSize(15); value.setPadding(dp(14), dp(14), dp(14), dp(14)); value.setBackgroundColor(Color.rgb(244,201,163)); return value; }
  private void loadFaq(ScrollView chat) { for (int i = 0; i < questions.length(); i++) { String question = questions.optString(i); Button button = new Button(this); button.setText(question); button.setOnClickListener(v -> submit(question, chat)); faq.addView(button); } }
  private void submit(String raw, ScrollView chat) { String question = raw.trim(); if (question.isEmpty()) return; addMarkdown(question, true); JSONObject card = readObject(question + "/updateComponents.json"); JSONObject data = readObject(question + "/updateDataModel.json"); if (card.length() == 0 || data.length() == 0) { addMarkdown("暂无无法回答", false); return; } String id = "surface_" + System.nanoTime(); NativeAgenUISurfaceHost host = new NativeAgenUISurfaceHost(this); messages.addView(host, new LinearLayout.LayoutParams(-1, -2)); try { host.receive(json("createSurface", new JSONObject().put("surfaceId", id).put("catalogId", "https://a2ui.org/specification/v0_9/standard_catalog.json"))); card.getJSONObject("updateComponents").put("surfaceId", id); data.getJSONObject("updateDataModel").put("surfaceId", id); host.receive(card.toString()); host.receive(data.toString()); } catch (JSONException error) { addMarkdown("卡片加载失败", false); } messages.post(() -> chat.fullScroll(View.FOCUS_DOWN)); }
  private void addMarkdown(String text, boolean user) { PrinterMarkDownTextView view = new PrinterMarkDownTextView(this); view.init(MarkdownStyles.getDefaultStyles(), null); view.setMarkdownText(text); view.setTextColor(Color.rgb(51,40,34)); view.setTextSize(16); view.setPadding(dp(10), dp(8), dp(10), dp(8)); LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-2, -2); p.gravity = user ? Gravity.RIGHT : Gravity.LEFT; messages.addView(view, p); }
  private String json(String key, JSONObject value) throws JSONException { return new JSONObject().put("version", "v0.9").put(key, value).toString(); }
  private JSONObject readObject(String path) { try (InputStream stream = getAssets().open(path)) { byte[] bytes = new byte[stream.available()]; stream.read(bytes); return new JSONObject(new String(bytes, StandardCharsets.UTF_8)); } catch (Exception ignored) { return new JSONObject(); } }
  private JSONArray readArray(String path) { try (InputStream stream = getAssets().open(path)) { byte[] bytes = new byte[stream.available()]; stream.read(bytes); return new JSONArray(new String(bytes, StandardCharsets.UTF_8)); } catch (Exception ignored) { return new JSONArray(); } }
  private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density + .5f); }
}
