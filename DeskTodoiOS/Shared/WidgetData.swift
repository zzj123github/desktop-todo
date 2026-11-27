import Foundation
import WidgetKit

struct WidgetSnapshot: Codable {
    var total: Int = 0
    var done: Int = 0
    var overdue: Int = 0
    var nextTitle: String? = nil
    var nextDue: Date? = nil
    var pct: Double = 0
    var items: [WidgetItem] = []
}

struct WidgetItem: Codable, Identifiable {
    var id: String
    var title: String
    var due: Date?
    var overdue: Bool
    var done: Bool
}

enum WidgetStore {
    static let suite = "group.com.desktodo.ios"
    static var defaults: UserDefaults { UserDefaults(suiteName: suite) ?? .standard }

    static func write(_ s: WidgetSnapshot) {
        let enc = JSONEncoder(); enc.dateEncodingStrategy = .iso8601
        if let d = try? enc.encode(s) { defaults.set(d, forKey: "snapshot") }
        WidgetCenter.shared.reloadAllTimelines()
    }

    static func read() -> WidgetSnapshot {
        let dec = JSONDecoder(); dec.dateDecodingStrategy = .iso8601
        if let d = defaults.data(forKey: "snapshot"),
           let s = try? dec.decode(WidgetSnapshot.self, from: d) { return s }
        return WidgetSnapshot()
    }
}