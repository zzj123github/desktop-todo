import SwiftUI
import SwiftData

struct AddSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var toast: ToastCenter
    @Query(sort: \Project.createdAt) private var projects: [Project]
    @Query(sort: \Tag.createdAt) private var tags: [Tag]

    @State private var text = ""
    @State private var project: String? = nil
    @State private var priority: Priority = .none
    @State private var due: Date? = nil
    @State private var selTags: Set<String> = []
    @State private var showDate = false
    @FocusState private var focused: Bool

    private var parsed: QuickParse { QuickAdd.parse(text, knownTags: tags.map { $0.name }) }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(title: "添加任务") { dismiss() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        HairlineBox {
                            TextField("输入任务，试试「明天 9:00 整理桌面 #设备 !高」", text: $text, axis: .vertical)
                                .font(F.sans(15))
                                .lineLimit(1...5)
                                .focused($focused)
                        }
                        if !text.isEmpty { preview }
                        selectors
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 4)
                }
                footer
            }
            .background(T.paper)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showDate) {
                DatePickerSheet(date: $due) { showDate = false }
                    .presentationDetents([.medium, .large])
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
        .onAppear { focused = true }
    }

    var preview: some View {
        let p = parsed
        return HStack(spacing: 6) {
            if let d = p.due { Chip(text: DT.dueText(d), systemImage: "calendar") }
            if p.priority != .none { Chip(text: p.priority.label, systemImage: "flag.fill") }
            ForEach(p.tags, id: \.self) { Chip(text: "#\($0)") }
            if p.due == nil && p.priority == .none && p.tags.isEmpty {
                Text("未识别到日期/标签，将存入收件箱")
                    .font(F.sans(12)).foregroundStyle(T.faint)
            }
        }
    }

    var selectors: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "安排")
            FlowRow(spacing: 8) {
                Menu {
                    Button("无项目") { project = nil }
                    ForEach(projects) { p in Button(p.name) { project = p.name } }
                } label: {
                    SelectorChip(icon: "folder", text: project ?? "项目", active: project != nil)
                }
                Menu {
                    ForEach(Priority.allCases) { pr in Button(pr.label) { priority = pr } }
                } label: {
                    SelectorChip(icon: "flag", text: priority == .none ? "优先级" : priority.label, active: priority != .none)
                }
                Button { showDate = true } label: {
                    SelectorChip(icon: "calendar", text: due.map { DT.dueText($0) } ?? "日期", active: due != nil)
                }
                .buttonStyle(.plain)
                Menu {
                    ForEach(tags) { t in
                        Button {
                            if selTags.contains(t.name) { selTags.remove(t.name) } else { selTags.insert(t.name) }
                        } label: {
                            Label(t.name, systemImage: selTags.contains(t.name) ? "checkmark" : "tag")
                        }
                    }
                } label: {
                    SelectorChip(icon: "tag", text: selTags.isEmpty ? "标签" : "\(selTags.count) 标签", active: !selTags.isEmpty)
                }
            }
        }
    }

    var footer: some View {
        HStack(spacing: 10) {
            GhostButton(title: "取消") { dismiss() }
            PrimaryButton(title: "保存", disabled: parsed.title.isEmpty) { save() }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(T.paper.overlay(alignment: .top) { Rectangle().fill(T.hairline).frame(height: 1) })
    }

    func save() {
        let p = parsed
        guard !p.title.isEmpty else { return }
        let finalTags = Array(Set(p.tags).union(selTags))
        let task = TodoTask(title: p.title, project: project, tags: finalTags,
                            priority: priority != .none ? priority : p.priority,
                            due: due ?? p.due)
        context.insert(task)
        try? context.save()
        Notifications.schedule(for: task)
        WidgetSync.refresh(context)
        Haptic.success()
        toast.show("已添加「\(task.title)」")
        dismiss()
    }
}

// 简单流式布局
struct FlowRow: Layout {
    var spacing: CGFloat = 8
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0
        for sv in subviews {
            let s = sv.sizeThatFits(.unspecified)
            if x + s.width > maxW && x > 0 { x = 0; y += rowH + spacing; rowH = 0 }
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
        return CGSize(width: maxW == .infinity ? x : maxW, height: y + rowH)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for sv in subviews {
            let s = sv.sizeThatFits(.unspecified)
            if x + s.width > bounds.maxX && x > bounds.minX { x = bounds.minX; y += rowH + spacing; rowH = 0 }
            sv.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing; rowH = max(rowH, s.height)
        }
    }
}