import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var toast: ToastCenter
    @AppStorage("notifyEnabled") private var notifyEnabled = true
    @State private var showManage = false
    @State private var showHelp = false
    @State private var confirmReset = false
    @Query private var tasks: [TodoTask]

    var body: some View {
        NavigationStack {
            List {
                Section("提醒") {
                    Toggle(isOn: $notifyEnabled) {
                        Label("到期通知", systemImage: "bell")
                    }
                    .tint(T.accent)
                    .onChange(of: notifyEnabled) { _, on in
                        if on { Notifications.requestAuth() }
                    }
                }
                Section("管理") {
                    Button { showManage = true } label: {
                        Label("项目与标签", systemImage: "folder.badge.gearshape").foregroundStyle(T.ink)
                    }
                }
                Section("帮助") {
                    Button { showHelp = true } label: {
                        Label("使用说明", systemImage: "questionmark.circle").foregroundStyle(T.ink)
                    }
                }
                Section("数据") {
                    ShareLink(item: exportJSON(), preview: SharePreview("桌面待办备份")) {
                        Label("导出数据（JSON）", systemImage: "square.and.arrow.up").foregroundStyle(T.ink)
                    }
                    Button(role: .destructive) { confirmReset = true } label: {
                        Label("重置演示数据", systemImage: "arrow.counterclockwise")
                    }
                }
                Section("关于") {
                    HStack {
                        Label("桌面待办 · iOS", systemImage: "checkmark.circle")
                        Spacer()
                        Text("v1.0").font(F.sans(13)).foregroundStyle(T.faint)
                    }
                    Text("纯本地存储，风格延续桌面版 dsh-claude-style。")
                        .font(F.sans(12)).foregroundStyle(T.muted)
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(T.canvas)
            .listRowBackground(T.card)
            .listRowSeparatorTint(T.hairSoft)
            .navigationTitle("设置")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showManage) { ManageSheet().environmentObject(toast) }
            .sheet(isPresented: $showHelp) { HelpSheet() }
            .alert("重置演示数据？", isPresented: $confirmReset) {
                Button("重置", role: .destructive) {
                    Seed.reset(context); toast.show("已恢复演示数据")
                }
                Button("取消", role: .cancel) {}
            } message: {
                Text("将清空当前数据并恢复初始演示任务。")
            }
        }
        .onAppear { if notifyEnabled { Notifications.requestAuth() } }
    }

    func exportJSON() -> String {
        struct Row: Codable {
            var title: String; var notes: String; var project: String?
            var tags: [String]; var priority: Int; var due: Date?; var done: Bool
        }
        let rows = tasks.map {
            Row(title: $0.title, notes: $0.notes, project: $0.project, tags: $0.tags,
                priority: $0.priorityRaw, due: $0.due, done: $0.done)
        }
        let enc = JSONEncoder(); enc.outputFormatting = [.prettyPrinted, .sortedKeys]
        enc.dateEncodingStrategy = .iso8601
        return (try? String(data: enc.encode(rows), encoding: .utf8)) ?? "[]"
    }
}

struct HelpSheet: View {
    @Environment(\.dismiss) private var dismiss
    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(title: "使用说明") { dismiss() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        help("三种形态", "完整 App、主屏幕小组件、锁屏胶囊共用同一份数据。小组件显示今天进度，锁屏胶囊显示条数与逾期。")
                        help("添加与编辑", "点底部中央 ＋ 快速添加，支持「明天 9:00 整理桌面 #设备 !高」自然语言。点任务行打开编辑。")
                        help("完成与删除", "点圆圈完成；左滑任务可完成或删除，删除后可在提示中撤销。")
                        help("视图与筛选", "「视图」页含收件箱/已逾期/即将到期与项目、标签。列表右上可五维筛选与搜索。")
                        help("链接", "编辑任务可挂网页链接，点击在浏览器打开。")
                        help("数据", "全部数据保存在本机，可在设置导出 JSON 或重置演示。")
                    }
                    .padding(.horizontal, 20).padding(.top, 4)
                }
                PrimaryButton(title: "知道了") { dismiss() }
                    .padding(.horizontal, 20).padding(.vertical, 14)
            }
            .background(T.paper)
            .toolbar(.hidden, for: .navigationBar)
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.visible)
    }
    func help(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).font(F.sans(15, .semibold)).foregroundStyle(T.ink)
            Text(body).font(F.sans(13)).foregroundStyle(T.ink2).lineSpacing(3)
        }
    }
}