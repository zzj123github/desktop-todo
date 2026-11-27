import SwiftUI
import SwiftData

struct ViewsView: View {
    @Environment(\.modelContext) private var context
    @EnvironmentObject private var toast: ToastCenter
    @Query(sort: \Project.createdAt) private var projects: [Project]
    @Query(sort: \Tag.createdAt) private var tags: [Tag]
    @Query private var all: [TodoTask]
    @State private var showManage = false

    private func count(_ pred: (TodoTask, Date) -> Bool) -> Int {
        let now = Date.now
        return all.filter { !$0.done && pred($0, now) }.count
    }

    var body: some View {
        NavigationStack {
            List {
                Section("桌面视图") {
                    navRow("收件箱", icon: "tray", tint: T.icon,
                           count: count { t, _ in t.due == nil && t.project == nil }) {
                        TaskListView(title: "收件箱", subtitle: "未安排日期、未归项目",
                                     base: { t, _ in t.due == nil && t.project == nil })
                    }
                    navRow("已逾期", icon: "exclamationmark.circle", tint: T.accentDeep,
                           count: count { t, now in t.isOverdue(now) }) {
                        TaskListView(title: "已逾期", subtitle: "需要尽快处理",
                                     base: { t, now in t.isOverdue(now) })
                    }
                    navRow("即将到期", icon: "calendar", tint: T.link,
                           count: count { t, now in (t.due.map { $0 > now && !DT.isToday($0, now) } ?? false) }) {
                        TaskListView(title: "即将到期", subtitle: "未来安排",
                                     base: { t, now in t.due.map { $0 > now && !DT.isToday($0, now) } ?? false })
                    }
                }
                Section {
                    ForEach(projects) { p in
                        navRow(p.name, icon: "folder", tint: Color(hex: p.colorHex),
                               count: count { t, _ in t.project == p.name }) {
                            TaskListView(title: p.name, subtitle: "项目",
                                         base: { t, _ in t.project == p.name })
                        }
                    }
                } header: { sectionHeader("项目") }
                Section {
                    ForEach(tags) { tag in
                        navRow("#\(tag.name)", icon: "tag", tint: T.chipInk,
                               count: count { t, _ in t.tags.contains(tag.name) }) {
                            TaskListView(title: "#\(tag.name)", subtitle: "标签",
                                         base: { t, _ in t.tags.contains(tag.name) })
                        }
                    }
                } header: { sectionHeader("标签") }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(T.canvas)
            .listRowBackground(T.card)
            .listRowSeparatorTint(T.hairSoft)
            .navigationTitle("视图")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showManage = true } label: {
                        Image(systemName: "pencil").foregroundStyle(T.icon)
                    }
                }
            }
            .sheet(isPresented: $showManage) {
                ManageSheet().environmentObject(toast)
            }
        }
    }

    func sectionHeader(_ title: String) -> some View {
        HStack {
            Text(title).font(F.sans(12, .semibold)).foregroundStyle(T.muted)
            Spacer()
            Button { showManage = true } label: {
                Image(systemName: "pencil").font(.system(size: 11)).foregroundStyle(T.faint)
            }.buttonStyle(.plain)
        }
    }

    func navRow<Dest: View>(_ title: String, icon: String, tint: Color,
                            count: Int, @ViewBuilder dest: () -> Dest) -> some View {
        NavigationLink(destination: dest().environmentObject(toast)) {
            HStack(spacing: 12) {
                Image(systemName: icon).font(.system(size: 15)).foregroundStyle(tint)
                    .frame(width: 24)
                Text(title).font(F.sans(15)).foregroundStyle(T.ink)
                Spacer()
                if count > 0 {
                    Text("\(count)").font(F.sans(13)).foregroundStyle(T.faint)
                }
            }
            .padding(.vertical, 4)
        }
    }
}