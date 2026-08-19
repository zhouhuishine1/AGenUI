package com.amap.agenuiplayground;

import android.content.Context;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.lang.reflect.Type;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * File-backed store for the scanned-session history shown on the home screen.
 *
 * <p>Items are keyed by {@code sessionId} (the A2UI surfaceId carried by the
 * scanned {@code createSurface} event) so re-scanning the same session
 * overwrites the existing record instead of adding a duplicate.
 */
public final class ScanHistoryStore {

    private static final String FILE_NAME = "scan_history.json";
    private static final Gson GSON = new Gson();
    private static final Type LIST_TYPE = new TypeToken<List<ScanHistoryItem>>() {}.getType();

    private ScanHistoryStore() {
    }

    /** A single persisted scan record. */
    public static class ScanHistoryItem {
        public String sessionId;
        public String name;
        public long createdAt; // epoch millis
        public String createSurfaceJson;
        public String updateComponentsJson;
        public String updateDataModelJson;
    }

    private static File file(Context context) {
        return new File(context.getFilesDir(), FILE_NAME);
    }

    /** Load items sorted newest-first. */
    public static synchronized List<ScanHistoryItem> load(Context context) {
        File f = file(context);
        if (!f.exists()) {
            return new ArrayList<>();
        }
        try (FileReader reader = new FileReader(f)) {
            List<ScanHistoryItem> items = GSON.fromJson(reader, LIST_TYPE);
            if (items == null) {
                items = new ArrayList<>();
            }
            sort(items);
            return items;
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    /** Insert a new record or overwrite the one with the same sessionId. */
    public static synchronized void upsert(Context context, ScanHistoryItem item) {
        List<ScanHistoryItem> items = load(context);
        int idx = -1;
        for (int i = 0; i < items.size(); i++) {
            if (items.get(i).sessionId != null && items.get(i).sessionId.equals(item.sessionId)) {
                idx = i;
                break;
            }
        }
        if (idx >= 0) {
            items.set(idx, item);
        } else {
            items.add(item);
        }
        sort(items);
        persist(context, items);
    }

    /** Delete the records whose sessionId is in {@code sessionIds}. */
    public static synchronized void delete(Context context, Set<String> sessionIds) {
        List<ScanHistoryItem> items = load(context);
        List<ScanHistoryItem> remaining = new ArrayList<>();
        for (ScanHistoryItem it : items) {
            if (!sessionIds.contains(it.sessionId)) {
                remaining.add(it);
            }
        }
        persist(context, remaining);
    }

    /** Format an epoch-millis timestamp as "MM/dd HH:mm". */
    public static String formatTime(long millis) {
        return new SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
                .format(new Date(millis));
    }

    private static void sort(List<ScanHistoryItem> items) {
        Collections.sort(items, (a, b) -> Long.compare(b.createdAt, a.createdAt));
    }

    private static void persist(Context context, List<ScanHistoryItem> items) {
        try (FileWriter writer = new FileWriter(file(context))) {
            GSON.toJson(items, writer);
        } catch (Exception e) {
            // Best-effort persistence; ignore write failures.
        }
    }
}
