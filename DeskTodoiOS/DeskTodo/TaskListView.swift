import SwiftUI
import SwiftData

struct TaskListView: View {
    var title: String
    var subtitle: String
    var base: (TodoTask, Date) -> Bool
    var showStatusTabs: Bool = true
    var showFilter: Bool = true
    var ringValue: Double? = nil

    @Environment(\.modelContext) private var context
    @EnvironmentObject private var toast: ToastCenter
    @Query(sort: \TodoTask.createdAt) private var all: [TodoTask]

    @State private var status: StatusFilter = .all
    @State private var filter = FilterState()
    @State private var showFilterSheet = false
    @State private var editing: TodoTask?
    @State private var doneOpen = true
    @State private var searchOn = false
    @State private var now = Date.now

    private var filtered: [TodoTask] { all.filter { base($0, now) && filter.matches($0, now) } }
    private var active: [TodoTask] { filtered.filter { !$0.done }.sorted(by: sortRule) }
    private var doneTasks: [TodoTask] {
        filtered.filter { $0.done }.sorted { ($0.doneAt ?? .distantPast) > ($1.doneAt ?? .distantPast) }
    }

    private func sortRule(_ a: TodoTask, _ b: TodoTask) -> Bool {
        let ao = a.isOverdue(now), bo = b.isOverdue(now)
        if ao != bo { return ao }
        switch (a.due, b.due) {
        case let (x?, y?): if x != y { return x < y }
        case (_?, nil): return true
        case (nil, _?): return false
        default: break
        }
        if a.priorityRaw != b.priorityRaw { return a.priorityRaw > b.priorityRaw }
        return a.createdAt < b.createdAt
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                header
                if showStatusTabs { statusTabs }
                if searchOn { searchField }
                if filter.isActive { chipsRow }
                list
            }
            .background(T.canvas)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(item: $editing) { task in
                EditSheet(task: task).environmentObject(toast)
            }
            .sheet(isPresented: $showFilterSheet) {
                FilterSheet(filter: $filter).environmentObject(toast)
            }
        }
        .onAppear { now = .now }
    }

    var header: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title).font(F.serif(30)).foregroundStyle(T.ink)
                Text(subtitle).font(F.sans(13)).foregroundStyle(T.muted)
            }
            Spacer()
            if let ringValue {
                ProgressRing(value: ringValue, size: 44)
            }
            if showFilter {
                Button { showFilterSheet = true } label: {
                    Image(systemName: "line.3.horizontal.decrease.circle")
                        .font(.system(size: 20))
                        .foregroundStyle(filter.isActive ? T.accent : T.icon)
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                Button { withAnimation { searchOn.toggle() } } label: {
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 18))
                        .foregroundStyle(searchOn ? T.accent : T.icon)
                        .frame(width: 36, height: 44)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 12)
        .padding(.bottom, 10)
    }

    var statusTabs: some View {
        HStack(spacing: 6) {
            ForEach(StatusFilter.allCases) { s in
                Button {
                    status = s
                } label: {
                    Text(s.rawValue)
                        .font(F.sans(13, status == s ? .semibold : .regular))
                        .foregroundStyle(status == s ? T.ink : T.muted)
                        .padding(.horizontal, 12).padding(.vertical, 6)
                        .background(Capsule().fill(status == s ? T.selected : Color.clear))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 6)
    }

    var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.system(size: 13)).foregroundStyle(T.faint)
            TextField("搜索任务、备注、标签", text: $filter.kw)
                .font(F.sans(14))
            if !filter.kw.isEmpty {
                Button { filter.kw = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(T.faint)
                }.buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 9)
        .background(RoundedRectangle(cornerRadius: T.R.md).fill(T.fieldBg))
        .overlay(RoundedRectangle(cornerRadius: T.R.md).stroke(T.hairline, lineWidth: 1))
        .padding(.horizontal, 16).padding(.bottom, 8)
    }

    var chipsRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                if filter.date != .any { Chip(text: filter.date.label, selected: true) { filter.date = .any } }
                ForEach(Array(filter.projects), id: \.self) { p in Chip(text: p, selected: true) { filter.projects.remove(p) } }
                ForEach(Array(filter.tags), id: \.self) { t in Chip(text: "#\(t)", selected: true) { filter.tags.remove(t) } }
                ForEach(Array(filter.prios), id: \.self) { p in
                    Chip(text: Priority(rawValue: p)?.label ?? "", selected: true) { filter.prios.remove(p) }
                }
                Button("清除") { filter.clear() }
                    .font(F.sans(12, .medium)).foregroundStyle(T.accentDeep)
            }
            .padding(.horizontal, 16)
        }
        .padding(.bottom, 6)
    }

    var list: some View {
        List {
            if status != .done {
                Section {
                    ForEach(active) { task in row(task) }
                }
            }
            if status != .todo && !doneTasks.isEmpty {
                Section {
                    if doneOpen { ForEach(doneTasks) { task in row(task) } }
                } header: {
                    Button {
                        withAnimation { doneOpen.toggle() }
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: doneOpen ? "chevron.down" : "chevron.right")
                                .font(.system(size: 10))
                            Text("已完成 · \(doneTasks.count)")
                            Spacer()
                        }
                        .font(F.sans(12, .medium)).foregroundStyle(T.muted)
                    }
                    .buttonStyle(.plain)
                }
            }
            if active.isEmpty && (status == .todo || doneTasks.isEmpty) {
                Section {
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.seal").font(.system(size: 28)).foregroundStyle(T.faint)
                        Text(status == .done ? "还没有已完成的任务" : "这里空空如也")
                            .font(F.sans(14)).foregroundStyle(T.muted)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 40)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .listRowBackground(T.card)
        .listRowSeparatorTint(T.hairSoft)
        .environment(\.defaultMinListRowHeight, 52)
    }

    func row(_ task: TodoTask) -> some View {
        TaskRow(task: task, now: now,
                onToggle: { TaskActions.toggle(task, context: context) },
                onOpen: { editing = task })
            .listRowInsets(EdgeInsets(top: 0, leading: 8, bottom: 0, trailing: 12))
            .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                Button(role: .destructive) {
                    TaskActions.delete(task, context: context, toast: toast)
                } label: { Label("删除", systemImage: "trash") }
                Button {
                    TaskActions.toggle(task, context: context)
                } label: { Label(task.done ? "待办" : "完成", systemImage: "checkmark") }
                    .tint(T.success)
            }
    }
}