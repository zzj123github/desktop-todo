import Foundation
import SwiftData

struct TaskLink: Codable, Identifiable, Hashable {
    var id = UUID()
    var url: String
    var title: String
}

@Model
final class Project {
    var name: String
    var colorHex: UInt
    var createdAt: Date
    init(name: String, colorHex: UInt, createdAt: Date = .now) {
        self.name = name
        self.colorHex = colorHex
        self.createdAt = createdAt
    }
}

@Model
final class Tag {
    var name: String
    var createdAt: Date
    init(name: String, createdAt: Date = .now) {
        self.name = name
        self.createdAt = createdAt
    }
}

@Model
final class TodoTask {
    var uuid: UUID
    var title: String
    var notes: String
    var project: String?
    var tags: [String]
    var priorityRaw: Int
    var due: Date?
    var links: [TaskLink]
    var done: Bool
    var doneAt: Date?
    var createdAt: Date

    init(title: String, notes: String = "", project: String? = nil,
         tags: [String] = [], priority: Priority = .none, due: Date? = nil,
         links: [TaskLink] = [], done: Bool = false, createdAt: Date = .now) {
        self.uuid = UUID()
        self.title = title
        self.notes = notes
        self.project = project
        self.tags = tags
        self.priorityRaw = priority.rawValue
        self.due = due
        self.links = links
        self.done = done
        self.doneAt = done ? createdAt : nil
        self.createdAt = createdAt
    }

    var priority: Priority {
        get { Priority(rawValue: priorityRaw) ?? .none }
        set { priorityRaw = newValue.rawValue }
    }

    func isOverdue(_ now: Date = .now) -> Bool {
        guard let due, !done else { return false }
        return due < now
    }
}