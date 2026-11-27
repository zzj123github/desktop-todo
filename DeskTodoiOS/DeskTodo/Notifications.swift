import Foundation
import UserNotifications

enum Notifications {
    static func requestAuth() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .badge]) { _, _ in }
    }

    static func schedule(for task: TodoTask) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [task.uuid.uuidString])
        guard let due = task.due, !task.done, due > .now else { return }
        let content = UNMutableNotificationContent()
        content.title = "待办到期"
        content.body = task.title
        content.sound = .default
        let comps = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: due)
        let trigger = UNCalendarNotificationTrigger(dateMatching: comps, repeats: false)
        let req = UNNotificationRequest(identifier: task.uuid.uuidString, content: content, trigger: trigger)
        center.add(req)
    }

    static func cancel(_ task: TodoTask) {
        UNUserNotificationCenter.current()
            .removePendingNotificationRequests(withIdentifiers: [task.uuid.uuidString])
    }
}