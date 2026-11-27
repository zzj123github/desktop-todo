import SwiftUI
import SwiftData

struct FilterSheet: View {
    @Binding var filter: FilterState
    @Environment(\.dismiss) private var dismiss
    @Query(sort: \Project.createdAt) private var projects: [Project]
    @Query(sort: \Tag.createdAt) private var tags: [Tag]
    @State private var showDate = false
    @State private var customDate: Date? = nil

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                SheetHeader(title: "筛选") { dismiss() }
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        section("日期") {
                            FlowRow(spacing: 8) {
                                dateChip("全部", .any)
                                dateChip("今天", .today)
                                dateChip("明天", .tomorrow)
                                dateChip("本周", .week)
                                dateChip("已逾期", .overdue)
                                Button { showDate = true } label: {
                                    SelectorChip(icon: "calendar", text: "指定日期", active: isCustom)
                                }.buttonStyle(.plain)
                            }
                        }
                        section("项目") {
                            FlowRow(spacing: 8) {
                                ForEach(projects) { p in
                                    Chip(text: p.name, selected: filter.projects.contains(p.name), tint: Color(hex: p.colorHex)) {
                                        toggle(&filter.projects, p.name)
                                    }
                                }
                            }
                        }
                        section("标签") {
                            FlowRow(spacing: 8) {
                                ForEach(tags) { t in
                                    Chip(text: "#\(t.name)", selected: filter.tags.contains(t.name)) {
                                        toggle(&filter.tags, t.name)
                                    }
                                }
                            }
                        }
                        section("优先级") {
                            FlowRow(spacing: 8) {
                                ForEach(Priority.allCases.filter { $0 != .none }) { pr in
                                    Chip(text: pr.label, selected: filter.prios.contains(pr.rawValue)) {
                                        toggle(&filter.prios, pr.rawValue)
                                    }
                                }
                            }
                        }
                        section("关键词") {
                            HairlineBox {
                                TextField("搜索标题、备注、标签", text: $filter.kw).font(F.sans(14))
                            }
                        }
                    }
                    .padding(.horizontal, 20).padding(.top, 4)
                }
                footer
            }
            .background(T.paper)
            .toolbar(.hidden, for: .navigationBar)
            .sheet(isPresented: $showDate) {
                DatePickerSheet(date: $customDate) {
                    if let d = customDate { filter.date = .custom(d) }
                    showDate = false
                }
                .presentationDetents([.medium, .large])
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    var isCustom: Bool { if case .custom = filter.date { return true }; return false }

    func dateChip(_ label: String, _ value: DateFilter) -> some View {
        Chip(text: label, selected: filter.date == value) { filter.date = value }
    }

    func section<C: View>(_ title: String, @ViewBuilder content: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            FieldLabel(text: title)
            content()
        }
    }

    func toggle<T: Hashable>(_ set: inout Set<T>, _ v: T) {
        if set.contains(v) { set.remove(v) } else { set.insert(v) }
    }

    var footer: some View {
        HStack(spacing: 10) {
            GhostButton(title: "清除") { filter.clear() }
            PrimaryButton(title: "完成") { dismiss() }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(T.paper.overlay(alignment: .top) { Rectangle().fill(T.hairline).frame(height: 1) })
    }
}