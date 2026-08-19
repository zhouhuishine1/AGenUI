//
//  ScanHistoryStore.swift
//  Playground
//
//  Created on 2026/8/16.
//

import Foundation

/// A single scanned session persisted on the home screen.
struct ScanHistoryItem: Codable {
    /// Unique key = the A2UI surfaceId carried by ``createSurface``.
    var sessionId: String
    /// Display name (Session title) shown as the row's main title.
    var name: String
    /// Last saved time (seconds since 1970); shown as the row subtitle.
    var createdAt: TimeInterval
    var createSurfaceJson: String
    var updateComponentsJson: String
    var updateDataModelJson: String
}

/// File-backed store for the scanned-session history list.
final class ScanHistoryStore {
    static let shared = ScanHistoryStore()

    private let fileURL: URL

    private init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        fileURL = docs.appendingPathComponent("scan_history.json")
    }

    /// Items sorted newest-first.
    func loadItems() -> [ScanHistoryItem] {
        guard let data = try? Data(contentsOf: fileURL),
              let items = try? JSONDecoder().decode([ScanHistoryItem].self, from: data) else {
            return []
        }
        return items.sorted { $0.createdAt > $1.createdAt }
    }

    /// Insert a new session or overwrite the existing one with the same
    /// ``sessionId``. The list is re-sorted newest-first and returned.
    @discardableResult
    func upsert(_ item: ScanHistoryItem) -> [ScanHistoryItem] {
        var items = loadItems()
        if let idx = items.firstIndex(where: { $0.sessionId == item.sessionId }) {
            items[idx] = item
        } else {
            items.append(item)
        }
        items.sort { $0.createdAt > $1.createdAt }
        persist(items)
        return items
    }

    /// Remove the given sessionIds and return the remaining items.
    @discardableResult
    func delete(sessionIds: Set<String>) -> [ScanHistoryItem] {
        let items = loadItems().filter { !sessionIds.contains($0.sessionId) }
        persist(items)
        return items
    }

    private func persist(_ items: [ScanHistoryItem]) {
        if let data = try? JSONEncoder().encode(items) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }
}

extension ScanHistoryItem {
    /// Subtitle time in "MM/dd HH:mm" form.
    var formattedTime: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MM/dd HH:mm"
        return formatter.string(from: Date(timeIntervalSince1970: createdAt))
    }
}
