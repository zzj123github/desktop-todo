import SwiftUI

enum Haptic {
    static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    static func soft() { UIImpactFeedbackGenerator(style: .soft).impactOccurred() }
    static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

// 进度环：环内百分比留白，100% 略缩
struct ProgressRing: View {
    var value: Double // 0...1
    var size: CGFloat = 40
    var lineWidth: CGFloat = 4
    var body: some View {
        let pct = Int((value * 100).rounded())
        ZStack {
            Circle().stroke(T.ringTrack, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0.0001, value))
                .stroke(T.accent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(pct)%")
                .font(F.sans(pct == 100 ? size * 0.24 : size * 0.27, .semibold))
                .foregroundStyle(T.ringLabel)
        }
        .frame(width: size, height: size)
    }
}

struct CheckCircle: View {
    var done: Bool
    var action: () -> Void
    var body: some View {
        Button(action: { Haptic.light(); action() }) {
            ZStack {
                Circle()
                    .stroke(done ? T.accent : T.checkBorder, lineWidth: 1.5)
                    .frame(width: 22, height: 22)
                if done {
                    Circle().fill(T.accent).frame(width: 22, height: 22)
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(T.onAccent)
                }
            }
            .frame(width: 44, height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

struct Chip: View {
    var text: String
    var selected: Bool = false
    var tint: Color? = nil
    var systemImage: String? = nil
    var action: (() -> Void)? = nil
    var body: some View {
        let content = HStack(spacing: 4) {
            if let systemImage { Image(systemName: systemImage).font(.system(size: 10)) }
            if let tint { Circle().fill(tint).frame(width: 6, height: 6) }
            Text(text).font(F.sans(12, selected ? .semibold : .regular))
        }
        .padding(.horizontal, 9).padding(.vertical, 5)
        .foregroundStyle(selected ? T.accentDeep : (tint != nil ? T.chipInk : T.chipInk))
        .background(
            RoundedRectangle(cornerRadius: T.R.chip)
                .fill(selected ? T.accentSoft : (tint != nil ? T.chipTagBg : T.chipBg))
        )
        .overlay(
            RoundedRectangle(cornerRadius: T.R.chip)
                .stroke(selected ? T.chipSelBd : Color.clear, lineWidth: 1)
        )
        if let action {
            Button(action: action) { content }.buttonStyle(.plain)
        } else {
            content
        }
    }
}

struct PriorityFlag: View {
    var priority: Priority
    var body: some View {
        if priority != .none {
            Image(systemName: "flag.fill")
                .font(.system(size: 10))
                .foregroundStyle(color)
        }
    }
    var color: Color {
        switch priority {
        case .high: return T.prioHigh
        case .med: return T.prioMed
        case .low: return T.prioLow
        case .none: return .clear
        }
    }
}

struct TaskRow: View {
    var task: TodoTask
    var now: Date
    var onToggle: () -> Void
    var onOpen: () -> Void
    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            CheckCircle(done: task.done, action: onToggle)
            Button(action: onOpen) {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(task.title)
                            .font(F.sans(15, task.done ? .regular : .medium))
                            .foregroundStyle(task.done ? T.faint : T.ink)
                            .strikethrough(task.done, color: T.faint)
                            .lineLimit(2)
                        Spacer(minLength: 4)
                        PriorityFlag(priority: task.priority)
                    }
                    metaLine
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(.vertical, 10)
        }
    }

    @ViewBuilder var metaLine: some View {
        let overdue = task.isOverdue(now)
        HStack(spacing: 6) {
            if let due = task.due {
                Text(overdue ? "\(DT.dueText(due, now)) · \(DT.overdueText(due, now))" : DT.dueText(due, now))
                    .font(F.sans(12))
                    .foregroundStyle(overdue ? T.accentDeep : T.muted)
            }
            if let proj = task.project {
                Chip(text: proj, tint: projectColor(proj))
            }
            ForEach(task.tags.prefix(2), id: \.self) { tag in
                Chip(text: "#\(tag)")
            }
        }
    }

    func projectColor(_ name: String) -> Color {
        switch name {
        case "工作": return Color(hex: 0x6E8FB8)
        case "个人": return Color(hex: 0xC9A227)
        case "学习": return Color(hex: 0x7F9A6D)
        default: return T.muted
        }
    }
}

// Toast
@MainActor
final class ToastCenter: ObservableObject {
    @Published var message: String? = nil
    var undo: (() -> Void)? = nil
    private var task: Task<Void, Never>? = nil
    func show(_ msg: String, undo: (() -> Void)? = nil) {
        self.message = msg
        self.undo = undo
        task?.cancel()
        task = Task { [weak self] in
            try? await Task.sleep(nanoseconds: 3_500_000_000)
            if !Task.isCancelled { self?.message = nil; self?.undo = nil }
        }
    }
}

struct ToastView: View {
    @EnvironmentObject var toast: ToastCenter
    var body: some View {
        if let msg = toast.message {
            HStack(spacing: 12) {
                Text(msg).font(F.sans(13)).foregroundStyle(T.toastInk)
                if let undo = toast.undo {
                    Button("撤销") { undo(); toast.message = nil; toast.undo = nil }
                        .font(F.sans(13, .semibold))
                        .foregroundStyle(T.accent)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 11)
            .background(Capsule().fill(T.toastBg))
            .padding(.bottom, 90)
            .transition(.move(edge: .bottom).combined(with: .opacity))
        }
    }
}