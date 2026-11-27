import SwiftUI
import SwiftData

@main
struct DeskTodoApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
        .modelContainer(for: [TodoTask.self, Project.self, Tag.self])
    }
}