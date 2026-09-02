package com.amap.agenuirndemo;

import com.amap.agenui.AGenUI;
import com.amap.agenui.function.FunctionCallContext;
import com.amap.agenui.function.FunctionConfig;
import com.amap.agenui.function.FunctionResult;
import com.amap.agenui.function.IFunction;
import org.json.JSONObject;

public final class NativeFunctionRegistry {
  private static boolean registered;
  private NativeFunctionRegistry() {}

  public static synchronized void register() {
    if (registered) return;
    AGenUI.getInstance().registerFunction(new IFunction() {
      @Override public FunctionResult execute(FunctionCallContext context, String args) {
        try {
          JSONObject input = new JSONObject(args == null ? "{}" : args);
          String type = input.getString("type");
          String result = RNFunctionRuntime.execute(context.getSurfaceId(), "selectRepayOption", new JSONObject().put("type", type).toString());
          AgenUIChatBridge.showSelectionAlertMessage(new JSONObject(result).optString("message", "操作完成"));
          return FunctionResult.createSuccess(new JSONObject(result));
        } catch (Exception error) {
          return FunctionResult.createError(error.getMessage() == null ? "Function call failed" : error.getMessage());
        }
      }
      @Override public FunctionConfig getConfig() { return new FunctionConfig("selectRepayOption"); }
    });
    registered = true;
  }
}
