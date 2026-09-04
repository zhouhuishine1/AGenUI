# flutter_pet

Flutter add-to-app module for the in-app draggable Corgi companion.

The overlay uses the bundled `assets/corgi/spritesheet.webp` atlas. Idle uses
row 0, running uses row 7, and review uses row 8. Build the Android archives
before building the host app:

```sh
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home flutter build aar --no-profile --no-release
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home flutter build aar --no-profile --no-debug
```

The host app consumes the generated local Maven repository configured in
`rndemo/android/settings.gradle`.

## Getting Started

For help getting started with Flutter development, view the online
[documentation](https://flutter.dev/).

For instructions integrating Flutter modules to your existing applications,
see the [add-to-app documentation](https://flutter.dev/to/add-to-app).
