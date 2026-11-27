import Foundation

enum DateFilter: Equatable {
    case any, today, tomorrow, week, overdue, custom(Date)
    var label: String {
        switch self {
        case .any: return "日期"
        case .today: return "今天"
        case .tomorrow: return "明天"
        case .week: return "本周"
        case .overdue: return "已逾期"
        case .custom: return "指定日期"
        }
    }
}

struct FilterState: Equatable {
    var date: DateFilter = .any
    var projects: Set<String> = []
    var tags: Set<String> = []
    var prios: Set<Int> = []
    var kw: String = ""

    var isActive: Bool {
        date != .any || !projects.isEmpty || !tags.isEmpty || !prios.isEmpty || !kw.isEmpty
    }
    var activeCount: Int {
        (date != .any ? 1 : 0) + projects.count + tags.count + prios.count + (kw.isEmpty ? 0 : 1)
    }
    mutating func clear() { self = FilterState() }

    func matches(_ t: TodoTask, _ now: Date) -> Bool {
        if !kw.isEmpty {
            let hay = (t.title + " " + t.notes + " " + (t.project ?? "") + " " + t.tags.joined(separator: " ")).lowercased()
            if !hay.contains(kw.lowercased()) { return false }
        }
        if !projects.isEmpty, !projects.contains(t.project ?? "") { return false }
        if !tags.isEmpty, Set(t.tags).isDisjoint(with: tags) { return false }
        if !prios.isEmpty, !prios.contains(t.priorityRaw) { return false }
        switch date {
        case .any: break
        case .today:
            guard let d = t.due, DT.isToday(d, now) else { return false }
        case .tomorrow:
            guard let d = t.due, DT.isTomorrow(d, now) else { return false }
        case .week:
            guard let d = t.due else { return false }
            let diff = DT.dayDiff(d, now)
            if diff < 0 || diff > 7 { return false }
        case .overdue:
            if !t.isOverdue(now) { return false }
        case .custom(let day):
            guard let d = t.due, DT.cal.isDate(d, inSameDayAs: day) else { return false }
        }
        return true
    }
}

enum StatusFilter: String, CaseIterable, Identifiable {
    case all = "全部", todo = "待办", done = "已完成"
    var id: String { rawValue }
}