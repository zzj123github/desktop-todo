import Foundation
import SwiftData

enum WidgetSync {
    static func refresh(_ context: ModelContext) {
        let tasks = (try? context.fetch(FetchDescriptor<TodoTask>())) ?? []
        let now = Date.now
        let today = tasks.filter { t in
            (t.due.map { DT.isToday($0, now) } ?? false) || t.isOverdue(now)
        }
        let done = today.filter { $0.done }.count
        let overdue = tasks.filter { $0.isOverdue(now) }.count
        let upcoming = tasks.filter { !$0.done && $0.due != nil }
            .sorted { ($0.due ?? .distantFuture) < ($1.due ?? .distantFuture) }
        let next = upcoming.first
        var snap = WidgetSnapshot()
        snap.total = today.count
        snap.done = done
        snap.overdue = overdue
        snap.nextTitle = next?.title
        snap.nextDue = next?.due
        snap.pct = today.isEmpty ? 0 : Double(done) / Double(today.count)
        snap.items = upcoming.prefix(4).map {
            WidgetItem(id: $0.uuid.uuidString, title: $0.title, due: $0.due,
                       overdue: $0.isOverdue(now), done: $0.done)
        }
        WidgetStore.write(snap)
    }
}