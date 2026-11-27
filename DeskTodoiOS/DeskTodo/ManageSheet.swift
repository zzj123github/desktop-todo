import SwiftUI
import SwiftData

struct ManageSheet: View {
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var toast: ToastCenter
    @Query(sort: \Project.createdAt) private var projects: [Project]
    @Query(sort: \Tag.createdAt) private var tags: [Tag]
    @Query private var tasks: [TodoTask]

    @State private var newProject = ""
    @State private var newTag = ""
    @State private var renameText = ""
    @State private var renameProject: Project? = nil
    @State private var renameTag: Tag? = nil
    @State private var deleteProject: Project? = nil
    @State private var deleteTag: Tag? = nil

    private let palette: [UInt] = [0x6E8FB8, 0xC9A227, 0x7F9A6D, 0xB98A3C, 0x9A7FB8, 0xD97757]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(title: "管理项目与标签") { dismiss() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        projectSection
                        tagSection
                    }
                    .padding(.horizontal, 20).padding(.top, 4)
                }
            }
            .background(T.paper)
            .toolbar(.hidden, for: .navigationBar)
            .alert("重命名项目", isPresented: Binding(get: { renameProject != nil }, set: { if !$0 { renameProject = nil } })) {
                TextField("名称", text: $renameText)
                Button("保存") { commitRenameProject() }
                Button("取消", role: .cancel) { renameProject = nil }
            }
            .alert("重命名标签", isPresented: Binding(get: { renameTag != nil }, set: { if !$0 { renameTag = nil } })) {
                TextField("名称", text: $renameText)
                Button("保存") { commitRenameTag() }
                Button("取消", role: .cancel) { renameTag = nil }
            }
            .alert("删除项目？", isPresented: Binding(get: { deleteProject != nil }, set: { if !$0 { deleteProject = nil } })) {
                Button("删除", role: .destructive) { commitDeleteProject() }
                Button("取消", role: .cancel) { deleteProject = nil }
            } message: {
                if let p = deleteProject {
                    Text("「\(p.name)」下有 \(tasks.filter { $0.project == p.name }.count) 个任务，删除后它们将变为无项目。")
                }
            }
            .alert("删除标签？", isPresented: Binding(get: { deleteTag != nil }, set: { if !$0 { deleteTag = nil } })) {
                Button("删除", role: .destructive) { commitDeleteTag() }
                Button("取消", role: .cancel) { deleteTag = nil }
            } message: {
                if let t = deleteTag {
                    Text("「\(t.name)」将从 \(tasks.filter { $0.tags.contains(t.name) }.count) 个任务上移除。")
                }
            }
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }

    var projectSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "项目")
            ForEach(projects) { p in
                HStack(spacing: 10) {
                    Circle().fill(Color(hex: p.colorHex)).frame(width: 10, height: 10)
                    Text(p.name).font(F.sans(15)).foregroundStyle(T.ink)
                    Spacer()
                    Text("\(tasks.filter { $0.project == p.name }.count)")
                        .font(F.sans(12)).foregroundStyle(T.faint)
                    Button { renameText = p.name; renameProject = p } label: {
                        Image(systemName: "pencil").font(.system(size: 12)).foregroundStyle(T.icon)
                    }.buttonStyle(.plain)
                    Button { deleteProject = p } label: {
                        Image(systemName: "trash").font(.system(size: 12)).foregroundStyle(T.faint)
                    }.buttonStyle(.plain)
                }
                .padding(.vertical, 6)
            }
            addRow(text: $newProject, placeholder: "新项目名") { addProject() }
        }
    }

    var tagSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: "标签")
            ForEach(tags) { t in
                HStack(spacing: 10) {
                    Image(systemName: "tag").font(.system(size: 12)).foregroundStyle(T.chipInk)
                    Text(t.name).font(F.sans(15)).foregroundStyle(T.ink)
                    Spacer()
                    Text("\(tasks.filter { $0.tags.contains(t.name) }.count)")
                        .font(F.sans(12)).foregroundStyle(T.faint)
                    Button { renameText = t.name; renameTag = t } label: {
                        Image(systemName: "pencil").font(.system(size: 12)).foregroundStyle(T.icon)
                    }.buttonStyle(.plain)
                    Button { deleteTag = t } label: {
                        Image(systemName: "trash").font(.system(size: 12)).foregroundStyle(T.faint)
                    }.buttonStyle(.plain)
                }
                .padding(.vertical, 6)
            }
            addRow(text: $newTag, placeholder: "新标签名") { addTag() }
        }
    }

    func addRow(text: Binding<String>, placeholder: String, action: @escaping () -> Void) -> some View {
        HairlineBox {
            HStack(spacing: 8) {
                TextField(placeholder, text: text).font(F.sans(14))
                    .onSubmit(action)
                Button("添加", action: action)
                    .font(F.sans(13, .semibold)).foregroundStyle(T.accent)
                    .disabled(text.wrappedValue.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
    }

    func addProject() {
        let name = newProject.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        guard !projects.contains(where: { $0.name == name }) else { toast.show("项目名已存在"); return }
        context.insert(Project(name: name, colorHex: palette[projects.count % palette.count]))
        try? context.save(); newProject = ""
    }
    func addTag() {
        let name = newTag.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { return }
        guard !tags.contains(where: { $0.name == name }) else { toast.show("标签名已存在"); return }
        context.insert(Tag(name: name)); try? context.save(); newTag = ""
    }

    func commitRenameProject() {
        guard let p = renameProject else { return }
        let name = renameText.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, name != p.name else { renameProject = nil; return }
        guard !projects.contains(where: { $0.name == name }) else { toast.show("项目名已存在"); return }
        let old = p.name
        for t in tasks where t.project == old { t.project = name }
        p.name = name
        try? context.save(); renameProject = nil
    }
    func commitRenameTag() {
        guard let tag = renameTag else { return }
        let name = renameText.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty, name != tag.name else { renameTag = nil; return }
        guard !tags.contains(where: { $0.name == name }) else { toast.show("标签名已存在"); return }
        let old = tag.name
        for t in tasks {
            if let i = t.tags.firstIndex(of: old) { t.tags[i] = name }
        }
        tag.name = name
        try? context.save(); renameTag = nil
    }

    func commitDeleteProject() {
        guard let p = deleteProject else { return }
        let name = p.name, hex = p.colorHex
        let affected = tasks.filter { $0.project == name }
        for t in affected { t.project = nil }
        context.delete(p); try? context.save()
        deleteProject = nil
        toast.show("已删除项目「\(name)」") {
            let np = Project(name: name, colorHex: hex)
            context.insert(np)
            for t in affected { t.project = name }
            try? context.save()
        }
    }
    func commitDeleteTag() {
        guard let tag = deleteTag else { return }
        let name = tag.name
        let affected = tasks.filter { $0.tags.contains(name) }
        for t in affected { t.tags.removeAll { $0 == name } }
        context.delete(tag); try? context.save()
        deleteTag = nil
        toast.show("已删除标签「\(name)」") {
            context.insert(Tag(name: name))
            for t in affected { t.tags.append(name) }
            try? context.save()
        }
    }
}