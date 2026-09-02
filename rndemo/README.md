# AGenUI Android Native Chat Demo

页面已经迁移到 Java 原生 Views：待办、对话、FAQ、输入框和发送按钮均由 `MainActivity` 创建；FluidMarkdown 和 AGenUI 卡片直接使用 Android SDK。RN 不再承载页面，只作为按次启动的 Function Call 执行 Runtime。

## 架构与生命周期

```text
MainActivity (Java Views)
  ├─ PrinterMarkDownTextView（普通文本）
  ├─ NativeAgenUISurfaceHost → AGenUI SurfaceManager（卡片）
  └─ NativeFunctionRegistry → RNFunctionRuntime
                                  └─ 隐藏 ReactRootView（一次调用后销毁）
```

卡片中的 `functionCall` 由 AGenUI 原生引擎触发。`RNFunctionRuntime` 创建一次隐藏 RN Root，发送 `RunFunctionCall` 事件，等待 `completeFunctionCall` 回传，默认 5 秒超时并销毁 Runtime。Function 名称和参数在原生侧白名单校验，不能执行任意 JS。

本地协议文件由 Gradle `assets.srcDir("../../contents")` 打包，原生侧按 `index.json` 和问题目录读取；A2UI v0.9 的 `createSurface`、`updateComponents`、`updateDataModel` 顺序保持不变。

## Native Bridge Contract

Android 原生层需要注册以下组件和模块：

- `AgenUISurface`：接收 `surfaceId`，内部挂载 AGenUI `Surface.getContainer()`。
- `AGenUIChatBridge.receiveTextChunk(surfaceId, json)`：将 A2UI v0.9 JSON 转给 `SurfaceManager`。
- `AGenUIChatBridge.destroySurface(surfaceId)`：释放 Surface。
- `AgenUIAction` 事件：事件 payload 为 `{ call: "selectRepayOption", args: { type } }`。

RN Bundle 仍需通过 Metro 生成，因为 Function Runtime 使用同一 JS Bundle；但启动页面不再挂载 RN UI。

## 本机验证

需要 JDK 17、Android SDK 和已启动的 `emulator-5554`。当前机器缺少项目 Wrapper 和全局 Gradle，安装 Gradle 8.13 后执行：

```sh
cd rndemo/android
JAVA_HOME=/path/to/jdk-17 /path/to/gradle-8.13/bin/gradle assembleRelease
$ANDROID_HOME/platform-tools/adb -s emulator-5554 install -r app/build/outputs/apk/release/app-release.apk
```

验收：点击原生“发送”后出现 FluidMarkdown 消息和 AGenUI 还款卡片；点击任一还款按钮后，RN Runtime 启动、返回结果并显示原生弹框，随后 Runtime 被销毁。输入不存在的主题显示失败文本，A2UI 文件缺失时不创建 Surface。

## 验证清单

- `git diff --check`：通过。
- `codegraph sync .`：通过。
- `cd rndemo && npm test -- --runInBand`：当前失败于仓库未安装 `jest` 命令。
- `cd rndemo/android && ./gradlew assembleRelease`：需要先补齐 Gradle Wrapper 或安装 Gradle 8.13。
