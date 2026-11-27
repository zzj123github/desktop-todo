import SwiftUI
import SwiftData

struct EditSheet: View {
    @Bindable var task: TodoTask
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var toast: ToastCenter
    @Query(sort: \Project.createdAt) private var projects: [Project]
    @Query(sort: \Tag.createdAt) private var tags: [Tag]

    @State private var showDate = false
    @State private var newURL = ""
    @State private var newTitle = ""
    @State private var confirmDelete = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(title: "编辑任务") { commit(); dismiss() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        titleNotes
                        arrangement
                        linksSection
                        deleteButton
                    }
                    .padding(.horizontal, 20).padding(.top, 4).padding(.bottom, 20)
                }
            }
            .background(T.paper)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showDate) {
                DatePickerSheet(date: Binding(get: { task.due }, set: { task.due = $0; commit() })) {
                    showDate = false
                }
                .presentationDetents([.medium, .large])
            }
            .alert("删除任务？", isPresented: $confirmDelete) {
                Button("删除", role: .destructive) {
                    TaskActions.delete(task, context: context, toast: toast)
                    dismiss()
                }
                Button("取消", role: .cancel) {}
            } message: {
                Text("「\(task.title)」将被删除，可在提示中撤销。")
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    var titleNotes: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "标题")
            HairlineBox {
                TextField("任务标题", text: $task.title, axis: .vertical)
                    .font(F.sans(16, .medium)).lineLimit(1...4)
            }
            FieldLabel(text: "备注")
            HairlineBox {
                TextField("补充说明（可选）", text: $task.notes, axis: .vertical)
                    .font(F.sans(14)).lineLimit(1...6)
            }
        }
    }

    var arrangement: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "安排")
            FlowRow(spacing: 8) {
                Menu {
                    Button("无项目") { task.project = nil; commit() }
                    ForEach(projects) { p in Button(p.name) { task.project = p.name; commit() } }
                } label: {
                    SelectorChip(icon: "folder", text: task.project ?? "项目", active: task.project != nil)
                }
                Menu {
                    ForEach(Priority.allCases) { pr in Button(pr.label) { task.priority = pr; commit() } }
                } label: {
                    SelectorChip(icon: "flag", text: task.priority == .none ? "优先级" : task.priority.label, active: task.priority != .none)
                }
                Button { showDate = true } label: {
                    SelectorChip(icon: "calendar", text: task.due.map { DT.dueText($0) } ?? "日期", active: task.due != nil)
                }.buttonStyle(.plain)
                Menu {
                    ForEach(tags) { t in
                        Button {
                            if task.tags.contains(t.name) { task.tags.removeAll { $0 == t.name } }
                            else { task.tags.append(t.name) }
                            commit()
                        } label: {
                            Label(t.name, systemImage: task.tags.contains(t.name) ? "checkmark" : "tag")
                        }
                    }
                } label: {
                    SelectorChip(icon: "tag", text: task.tags.isEmpty ? "标签" : "\(task.tags.count) 标签", active: !task.tags.isEmpty)
                }
            }
            if !task.tags.isEmpty {
                FlowRow(spacing: 6) {
                    ForEach(task.tags, id: \.self) { tag in
                        Chip(text: "#\(tag)") { task.tags.removeAll { $0 == tag }; commit() }
                    }
                }
            }
        }
    }

    var linksSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "链接")
            if task.links.isEmpty {
                Text("还没有链接").font(F.sans(13)).foregroundStyle(T.faint)
            }
            ForEach(task.links) { link in
                HStack(spacing: 10) {
                    Image(systemName: linkIcon(link.url)).font(.system(size: 14)).foregroundStyle(T.link)
                    Button { open(link) } label: {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(link.title).font(F.sans(14)).foregroundStyle(T.ink).lineLimit(1)
                            Text(link.url).font(F.sans(11)).foregroundStyle(T.faint).lineLimit(1)
                        }
                    }.buttonStyle(.plain)
                    Spacer()
                    Button { task.links.removeAll { $0.id == link.id }; commit() } label: {
                        Image(systemName: "xmark").font(.system(size: 11)).foregroundStyle(T.faint)
                    }.buttonStyle(.plain)
                }
                .padding(.vertical, 6)
            }
            HairlineBox {
                VStack(spacing: 8) {
                    TextField("地址（https://… 或路径）", text: $newURL)
                        .font(F.sans(13)).textInputAutocapitalization(.never).autocorrectionDisabled()
                    HStack(spacing: 8) {
                        TextField("标题（可选）", text: $newTitle).font(F.sans(13))
                        Button("添加") { addLink() }
                            .font(F.sans(13, .semibold)).foregroundStyle(T.accent)
                            .disabled(newURL.isEmpty)
                    }
                }
            }
        }
    }

    var deleteButton: some View {
        Button { confirmDelete = true } label: {
            HStack {
                Image(systemName: "trash")
                Text("删除任务")
            }
            .font(F.sans(14, .medium)).foregroundStyle(T.accentDeep)
            .frame(maxWidth: .infinity).frame(height: 44)
            .background(RoundedRectangle(cornerRadius: T.R.lg).fill(T.accentSoft))
        }
        .buttonStyle(.plain)
    }

    func linkIcon(_ url: String) -> String {
        if url.hasPrefix("http") { return "globe" }
        if url.hasSuffix("/") { return "folder" }
        return "doc"
    }

    func addLink() {
        let url = newURL.trimmingCharacters(in: .whitespaces)
        guard !url.isEmpty, !url.lowercased().hasPrefix("javascript:") else {
            toast.show("地址无法识别"); return
        }
        let title = newTitle.isEmpty ? autoTitle(url) : newTitle
        task.links.append(TaskLink(url: url, title: title))
        newURL = ""; newTitle = ""
        commit()
    }

    func autoTitle(_ url: String) -> String {
        var s = url.replacingOccurrences(of: "https://", with: "")
            .replacingOccurrences(of: "http://", with: "")
        if s.count > 44 { s = String(s.prefix(44)) + "…" }
        return s
    }

    func open(_ link: TaskLink) {
        if let u = URL(string: link.url), u.scheme?.hasPrefix("http") == true {
            UIApplication.shared.open(u)
        } else {
            toast.show("本地路径在 iOS 上不可直接打开")
        }
    }

    func commit() {
        try? context.save()
        Notifications.schedule(for: task)
        WidgetSync.refresh(context)
    }
}