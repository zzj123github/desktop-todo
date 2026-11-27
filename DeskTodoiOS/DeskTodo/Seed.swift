import Foundation
import SwiftData

enum Seed {
    static func populateIfNeeded(_ context: ModelContext) {
        let count = (try? context.fetchCount(FetchDescriptor<TodoTask>())) ?? 0
        guard count == 0 else { return }

        let work = Project(name: "工作", colorHex: 0x6E8FB8)
        let personal = Project(name: "个人", colorHex: 0xC9A227)
        let study = Project(name: "学习", colorHex: 0x7F9A6D)
        [work, personal, study].forEach { context.insert($0) }
        ["会议", "设备", "阅读"].forEach { context.insert(Tag(name: $0)) }

        let now = Date.now
        func at(_ dayOffset: Int, _ h: Int, _ m: Int = 0) -> Date {
            let base = DT.cal.date(byAdding: .day, value: dayOffset, to: DT.startOfDay(now))!
            return DT.cal.date(bySettingHour: h, minute: m, second: 0, of: base)!
        }

        let tasks: [TodoTask] = [
            TodoTask(title: "回复模具厂报价邮件", project: "工作", tags: ["设备"], priority: .high, due: at(0, 10, 0)),
            TodoTask(title: "整理本周会议纪要", project: "工作", tags: ["会议"], priority: .med, due: at(0, 14, 30)),
            TodoTask(title: "给绿植浇水", project: "个人", priority: .low, due: at(0, 18, 0)),
            TodoTask(title: "读完《设计中的设计》第三章", project: "学习", tags: ["阅读"], priority: .med, due: at(0, 21, 0)),
            TodoTask(title: "提交设备巡检表", project: "工作", tags: ["设备"], priority: .high, due: at(-1, 17, 0)),
            TodoTask(title: "预约牙医复诊", project: "个人", priority: .med, due: at(1, 9, 0)),
            TodoTask(title: "准备周会演示稿", project: "工作", tags: ["会议"], priority: .high, due: at(1, 15, 0)),
            TodoTask(title: "备份项目文件到移动硬盘", project: "工作", tags: ["设备"], priority: .low, due: at(2, 11, 0)),
            TodoTask(title: "练习 SwiftUI 动画", project: "学习", priority: .low, due: at(3, 20, 0)),
            TodoTask(title: "买咖啡豆", project: "个人", priority: .none, due: nil),
            TodoTask(title: "整理书桌抽屉", priority: .none, due: nil),
            TodoTask(title: "回顾上月开支", project: "个人", priority: .med, due: at(-2, 12, 0), done: true),
        ]
        tasks.forEach { context.insert($0) }
        try? context.save()
        WidgetSync.refresh(context)
    }

    static func reset(_ context: ModelContext) {
        try? context.delete(model: TodoTask.self)
        try? context.delete(model: Project.self)
        try? context.delete(model: Tag.self)
        try? context.save()
        populateIfNeeded(context)
    }
}