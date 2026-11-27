import SwiftUI
import SwiftData

@MainActor
enum TaskActions {
    static func toggle(_ task: TodoTask, context: ModelContext) {
        task.done.toggle()
        task.doneAt = task.done ? .now : nil
        try? context.save()
        if task.done { Haptic.success() } else { Haptic.light() }
        Notifications.schedule(for: task)
        WidgetSync.refresh(context)
    }

    static func delete(_ task: TodoTask, context: ModelContext, toast: ToastCenter) {
        // 快照以便撤销
        let snap = TodoTask(title: task.title, notes: task.notes, project: task.project,
                            tags: task.tags, priority: task.priority, due: task.due,
                            links: task.links, done: task.done, createdAt: task.createdAt)
        snap.doneAt = task.doneAt
        Notifications.cancel(task)
        context.delete(task)
        try? context.save()
        WidgetSync.refresh(context)
        toast.show("已删除「\(snap.title)」") {
            context.insert(snap)
            try? context.save()
            Notifications.schedule(for: snap)
            WidgetSync.refresh(context)
        }
    }
}