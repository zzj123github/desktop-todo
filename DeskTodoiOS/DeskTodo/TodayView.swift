import SwiftUI
import SwiftData

struct TodayView: View {
    @Query private var all: [TodoTask]
    private var now: Date { .now }
    private var todayTasks: [TodoTask] {
        all.filter { t in
            (t.due.map { DT.isToday($0, now) } ?? false) || t.isOverdue(now)
        }
    }
    private var ring: Double {
        let total = todayTasks.count
        guard total > 0 else { return 0 }
        return Double(todayTasks.filter { $0.done }.count) / Double(total)
    }
    private var remaining: Int { todayTasks.filter { !$0.done }.count }

    var body: some View {
        TaskListView(
            title: "今天",
            subtitle: "\(DT.fullDate(now)) · \(DT.greeting(now))，还剩 \(remaining) 件",
            base: { t, now in (t.due.map { DT.isToday($0, now) } ?? false) || t.isOverdue(now) },
            ringValue: ring
        )
    }
}

struct DoneView: View {
    var body: some View {
        TaskListView(
            title: "已完成",
            subtitle: "做完的事，都在这里",
            base: { t, _ in t.done },
            showStatusTabs: false
        )
    }
}