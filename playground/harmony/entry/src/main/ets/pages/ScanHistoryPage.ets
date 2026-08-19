import { common } from '@kit.AbilityKit';
import { router } from '@kit.ArkUI';

import {
  ScanHistoryItem,
  loadScanHistory,
  deleteScanHistory,
  formatScanTime
} from '../utils/ScanHistoryStore';

const COLOR_PRIMARY = '#6200EE';
const COLOR_PRIMARY_DARK = '#3700B3';
const COLOR_BG = '#FFFFFF';
const COLOR_BG_SECONDARY = '#F8F8F8';
const COLOR_TEXT = '#000000';
const COLOR_TEXT_SECONDARY = '#666666';
const COLOR_DIVIDER = '#E0E0E0';
const COLOR_RED = '#F44336';

/**
 * Home screen of the Playground: lists scanned sessions (newest first) with
 * their Session name and saved time. Long-press (or the Edit button) enters
 * multi-select mode exposing a bottom Delete toolbar.
 */
@Entry
@Component
struct ScanHistoryPage {
  @State items: ScanHistoryItem[] = [];
  @State editing: boolean = false;
  @State selectedIds: string[] = [];
  @State isDarkMode: boolean = false;

  aboutToAppear(): void {
    this.reload();
  }

  onPageShow(): void {
    // Refresh when returning from the preview so a new scan shows up.
    this.reload();
  }

  private reload(): void {
    const context = getContext(this) as common.UIAbilityContext;
    this.items = loadScanHistory(context);
  }

  private setEditing(value: boolean): void {
    this.editing = value;
    if (!value) {
      this.selectedIds = [];
    }
  }

  private toggleSelect(sessionId: string): void {
    const idx = this.selectedIds.indexOf(sessionId);
    if (idx >= 0) {
      this.selectedIds.splice(idx, 1);
    } else {
      this.selectedIds.push(sessionId);
    }
    // Reassign to trigger @State re-render.
    this.selectedIds = this.selectedIds.slice();
  }

  private isSelected(sessionId: string): boolean {
    return this.selectedIds.indexOf(sessionId) >= 0;
  }

  private scanTapped(): void {
    router.pushUrl({ url: 'pages/AGenUIDemoPage', params: { launchScan: true } });
  }

  private openItem(item: ScanHistoryItem): void {
    router.pushUrl({
      url: 'pages/AGenUIDemoPage',
      params: {
        sessionName: item.name,
        createSurfaceJson: item.createSurfaceJson,
        updateComponentsJson: item.updateComponentsJson,
        updateDataModelJson: item.updateDataModelJson
      }
    });
  }

  private onItemTap(item: ScanHistoryItem): void {
    if (this.editing) {
      this.toggleSelect(item.sessionId);
    } else {
      this.openItem(item);
    }
  }

  private onItemLongPress(item: ScanHistoryItem): void {
    if (!this.editing) {
      this.setEditing(true);
    }
    if (!this.isSelected(item.sessionId)) {
      this.selectedIds.push(item.sessionId);
      this.selectedIds = this.selectedIds.slice();
    }
  }

  private deleteSelected(): void {
    if (this.selectedIds.length === 0) {
      return;
    }
    const context = getContext(this) as common.UIAbilityContext;
    this.items = deleteScanHistory(context, this.selectedIds);
    this.setEditing(false);
  }

  build() {
    Stack({ alignContent: Alignment.Bottom }) {
      Column() {
        // Top bar
        Row() {
          Image($r('app.media.ic_menu'))
            .width(24)
            .height(24)
            .margin({ left: 16, right: 16 })
            .onClick(() => {
              router.pushUrl({ url: 'pages/AGenUIDemoPage', params: { openDrawer: true } });
            })

          Text('A2UI体验')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor(Color.White)
            .layoutWeight(1)
            .textAlign(TextAlign.Center)

          Text(this.editing ? '完成' : '编辑')
            .fontSize(16)
            .fontColor(Color.White)
            .margin({ right: 16 })
            .onClick(() => {
              this.setEditing(!this.editing);
            })

          Image($r('app.media.ic_scan'))
            .width(24)
            .height(24)
            .margin({ right: 16 })
            .fillColor(Color.White)
            .onClick(() => {
              this.scanTapped();
            })
        }
        .width('100%')
        .height(56)
        .backgroundColor(this.isDarkMode ? COLOR_PRIMARY_DARK : COLOR_PRIMARY)
        .alignItems(VerticalAlign.Center)

        // Content area
        if (this.items.length === 0) {
          Column() {
            Text('扫描二维码以开启体验')
              .fontSize(16)
              .fontColor(COLOR_TEXT_SECONDARY)
          }
          .width('100%')
          .layoutWeight(1)
          .justifyContent(FlexAlign.Center)
        } else {
          Scroll() {
            Column() {
              ForEach(this.items, (item: ScanHistoryItem) => {
                Row() {
                  Column() {
                    Text(item.name)
                      .fontSize(16)
                      .fontColor(COLOR_TEXT)
                      .maxLines(1)
                      .textOverflow({ overflow: TextOverflow.Ellipsis })

                    Text(formatScanTime(item.createdAt))
                      .fontSize(13)
                      .fontColor(COLOR_TEXT_SECONDARY)
                      .margin({ top: 4 })
                  }
                  .layoutWeight(1)
                  .alignItems(HorizontalAlign.Start)

                  if (this.editing) {
                    Text(this.isSelected(item.sessionId) ? '✓' : '')
                      .fontSize(20)
                      .fontColor(COLOR_PRIMARY)
                      .margin({ left: 12 })
                  }
                }
                .width('100%')
                .padding({ left: 16, right: 16, top: 14, bottom: 14 })
                .backgroundColor(COLOR_BG)
                .border({ width: { bottom: 0.5 }, color: COLOR_DIVIDER })
                .onClick(() => {
                  this.onItemTap(item);
                })
                .gesture(LongPressGesture({ repeat: false, duration: 400 })
                  .onAction(() => {
                    this.onItemLongPress(item);
                  }))
              }, (item: ScanHistoryItem) => item.sessionId)
            }
            .width('100%')
          }
          .width('100%')
          .layoutWeight(1)
          .scrollBar(BarState.Off)
          .edgeEffect(EdgeEffect.None)
          .align(Alignment.Top)
        }
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.isDarkMode ? '#121212' : COLOR_BG)

      // Bottom delete toolbar (edit mode only)
      if (this.editing) {
        Row() {
          Button('删除')
            .fontSize(16)
            .backgroundColor(this.selectedIds.length > 0 ? COLOR_RED : '#CCCCCC')
            .fontColor(Color.White)
            .enabled(this.selectedIds.length > 0)
            .width(120)
            .height(40)
            .onClick(() => {
              this.deleteSelected();
            })
        }
        .width('100%')
        .height(64)
        .padding({ right: 16 })
        .justifyContent(FlexAlign.End)
        .alignItems(VerticalAlign.Center)
        .backgroundColor(COLOR_BG_SECONDARY)
        .border({ width: { top: 0.5 }, color: COLOR_DIVIDER })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.isDarkMode ? '#121212' : COLOR_BG)
  }
}
