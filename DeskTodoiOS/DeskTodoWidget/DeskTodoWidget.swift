import WidgetKit
import SwiftUI

struct SnapshotEntry: TimelineEntry {
    let date: Date
    let snap: WidgetSnapshot
}

struct SnapshotProvider: TimelineProvider {
    func placeholder(in context: Context) -> SnapshotEntry {
        SnapshotEntry(date: .now, snap: WidgetSnapshot(total: 5, done: 2, overdue: 1, nextTitle: "准备周会演示稿", nextDue: .now, pct: 0.4))
    }
    func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
        completion(SnapshotEntry(date: .now, snap: WidgetStore.read()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
        let entry = SnapshotEntry(date: .now, snap: WidgetStore.read())
        completion(Timeline(entries: [entry], policy: .after(.now.addingTimeInterval(900))))
    }
}

struct WidgetRing: View {
    var value: Double
    var size: CGFloat
    var body: some View {
        ZStack {
            Circle().stroke(T.ringTrack, lineWidth: size * 0.1)
            Circle().trim(from: 0, to: max(0.0001, value))
                .stroke(T.accent, style: StrokeStyle(lineWidth: size * 0.1, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((value * 100).rounded()))%")
                .font(F.sans(size * 0.26, .semibold)).foregroundStyle(T.ringLabel)
        }
        .frame(width: size, height: size)
    }
}

struct DeskTodoWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: SnapshotEntry

    var body: some View {
        switch family {
        case .systemSmall: small
        case .systemMedium: medium
        case .accessoryCircular: circular
        case .accessoryRectangular: rectangular
        case .accessoryInline: inline
        default: small
        }
    }

    var small: some View {
        VStack(spacing: 8) {
            WidgetRing(value: entry.snap.pct, size: 64)
            Text("今天 \(entry.snap.done)/\(entry.snap.total)")
                .font(F.sans(13, .medium)).foregroundStyle(T.ink)
            if entry.snap.overdue > 0 {
                Text("逾期 \(entry.snap.overdue)")
                    .font(F.sans(11, .semibold)).foregroundStyle(T.accentDeep)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(T.canvas, for: .widget)
    }

    var medium: some View {
        HStack(spacing: 14) {
            VStack(spacing: 6) {
                WidgetRing(value: entry.snap.pct, size: 56)
                Text("今天 \(entry.snap.done)/\(entry.snap.total)")
                    .font(F.sans(12, .medium)).foregroundStyle(T.ink)
                if entry.snap.overdue > 0 {
                    Text("逾期 \(entry.snap.overdue)").font(F.sans(11, .semibold)).foregroundStyle(T.accentDeep)
                }
            }
            VStack(alignment: .leading, spacing: 7) {
                if entry.snap.items.isEmpty {
                    Text("今天没有安排").font(F.sans(13)).foregroundStyle(T.muted)
                }
                ForEach(entry.snap.items.prefix(3)) { item in
                    HStack(spacing: 6) {
                        Circle().stroke(item.overdue ? T.accentDeep : T.checkBorder, lineWidth: 1.5)
                            .frame(width: 12, height: 12)
                        Text(item.title).font(F.sans(13)).foregroundStyle(T.ink).lineLimit(1)
                        Spacer(minLength: 0)
                        if let d = item.due {
                            Text(DT.timeText(d)).font(F.sans(11)).foregroundStyle(item.overdue ? T.accentDeep : T.muted)
                        }
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .containerBackground(T.canvas, for: .widget)
    }

    var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 1) {
                Text("\(Int((entry.snap.pct * 100).rounded()))%")
                    .font(F.sans(15, .bold)).foregroundStyle(T.accent)
                Text("\(entry.snap.done)/\(entry.snap.total)")
                    .font(F.sans(9)).foregroundStyle(T.ink2)
            }
        }
        .containerBackground(.clear, for: .widget)
    }

    var rectangular: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(spacing: 5) {
                Text("今天 \(entry.snap.done)/\(entry.snap.total)")
                    .font(F.sans(13, .semibold)).foregroundStyle(T.ink)
                if entry.snap.overdue > 0 {
                    Text("· 逾期 \(entry.snap.overdue)").font(F.sans(12)).foregroundStyle(T.accentDeep)
                }
            }
            if let next = entry.snap.nextTitle {
                Text(next).font(F.sans(12)).foregroundStyle(T.ink2).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .containerBackground(.clear, for: .widget)
    }

    var inline: some View {
        Text("今天 \(entry.snap.done)/\(entry.snap.total)\(entry.snap.overdue > 0 ? " · 逾期 \(entry.snap.overdue)" : "")")
    }
}

struct DeskTodoWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DeskTodoWidget", provider: SnapshotProvider()) { entry in
            DeskTodoWidgetView(entry: entry)
        }
        .configurationDisplayName("桌面待办")
        .description("今天进度与最近到期。")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct DeskTodoWidgetBundle: WidgetBundle {
    var body: some Widget {
        DeskTodoWidget()
    }
}