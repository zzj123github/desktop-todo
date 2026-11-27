import SwiftUI

struct DatePickerSheet: View {
    @Binding var date: Date?
    var onDone: () -> Void

    @State private var month: Date = DT.startOfDay(.now)
    @State private var selectedDay: Date?
    @State private var hour: Int = 9
    @State private var minute: Int = 0
    @State private var error: String? = nil

    private let weekdays = ["一","二","三","四","五","六","日"]

    var body: some View {
        VStack(spacing: 0) {
            SheetHeader(title: "选择日期时间") { onDone() }
            ScrollView {
                VStack(spacing: 16) {
                    monthNav
                    weekdayRow
                    dayGrid
                    timeRow
                    quickRow
                    if let error {
                        Text(error).font(F.sans(12)).foregroundStyle(T.accentDeep)
                    }
                }
                .padding(.horizontal, 20)
            }
            footer
        }
        .background(T.paper)
        .onAppear(perform: setup)
    }

    private func setup() {
        if let d = date {
            selectedDay = DT.startOfDay(d)
            month = DT.startOfDay(d)
            hour = DT.cal.component(.hour, from: d)
            minute = DT.cal.component(.minute, from: d)
        } else {
            selectedDay = DT.startOfDay(.now)
            hour = max(9, DT.cal.component(.hour, from: .now))
        }
    }

    var monthNav: some View {
        HStack {
            Button { shiftMonth(-1) } label: {
                Image(systemName: "chevron.left").font(.system(size: 13)).foregroundStyle(T.icon)
                    .frame(width: 32, height: 32)
            }.buttonStyle(.plain)
            Spacer()
            Text(monthTitle).font(F.sans(15, .semibold)).foregroundStyle(T.ink)
            Spacer()
            Button { shiftMonth(1) } label: {
                Image(systemName: "chevron.right").font(.system(size: 13)).foregroundStyle(T.icon)
                    .frame(width: 32, height: 32)
            }.buttonStyle(.plain)
        }
    }
    var monthTitle: String {
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "yyyy年M月"
        return f.string(from: month)
    }
    func shiftMonth(_ n: Int) {
        month = DT.cal.date(byAdding: .month, value: n, to: month) ?? month
    }

    var weekdayRow: some View {
        HStack(spacing: 0) {
            ForEach(weekdays, id: \.self) { w in
                Text(w).font(F.sans(12)).foregroundStyle(T.faint).frame(maxWidth: .infinity)
            }
        }
    }

    var days: [Date?] {
        let first = DT.cal.date(from: DT.cal.dateComponents([.year, .month], from: month))!
        let range = DT.cal.range(of: .day, in: .month, for: first)!
        let firstWd = DT.cal.component(.weekday, from: first) // 1=Sun
        let leading = (firstWd + 5) % 7 // Monday-first offset
        var arr: [Date?] = Array(repeating: nil, count: leading)
        for d in range {
            arr.append(DT.cal.date(byAdding: .day, value: d - 1, to: first))
        }
        while arr.count % 7 != 0 { arr.append(nil) }
        return arr
    }

    var dayGrid: some View {
        let cols = Array(repeating: GridItem(.flexible(), spacing: 0), count: 7)
        return LazyVGrid(columns: cols, spacing: 4) {
            ForEach(Array(days.enumerated()), id: \.offset) { _, day in
                if let day { dayCell(day) } else { Color.clear.frame(height: 38) }
            }
        }
    }

    func dayCell(_ day: Date) -> some View {
        let now = Date.now
        let isPast = day < DT.startOfDay(now)
        let isToday = DT.isToday(day, now)
        let isSelected = selectedDay.map { DT.cal.isDate($0, inSameDayAs: day) } ?? false
        let num = DT.cal.component(.day, from: day)
        return Button {
            if !isPast { selectedDay = day; error = nil }
        } label: {
            Text("\(num)")
                .font(F.sans(14, isSelected ? .semibold : .regular))
                .foregroundStyle(isPast ? T.faint : (isSelected ? T.onAccent : T.ink))
                .frame(width: 36, height: 36)
                .background(
                    Circle().fill(isSelected ? T.accent : Color.clear)
                )
                .overlay(
                    Circle().stroke(isToday && !isSelected ? T.accent : Color.clear, lineWidth: 1)
                )
                .frame(maxWidth: .infinity)
                .frame(height: 38)
        }
        .buttonStyle(.plain)
        .disabled(isPast)
    }

    var timeRow: some View {
        HStack(spacing: 10) {
            Image(systemName: "clock").font(.system(size: 13)).foregroundStyle(T.icon)
            timeMenu(value: $hour, range: 0...23, suffix: "时")
            Text(":").foregroundStyle(T.muted)
            timeMenu(value: $minute, range: 0...59, suffix: "分")
            Spacer()
        }
    }

    func timeMenu(value: Binding<Int>, range: ClosedRange<Int>, suffix: String) -> some View {
        Menu {
            ForEach(Array(range), id: \.self) { v in
                Button(String(format: "%02d", v)) { value.wrappedValue = v }
            }
        } label: {
            HStack(spacing: 4) {
                Text(String(format: "%02d", value.wrappedValue)).font(F.sans(15, .medium)).foregroundStyle(T.ink)
                Text(suffix).font(F.sans(12)).foregroundStyle(T.muted)
                Image(systemName: "chevron.down").font(.system(size: 9)).foregroundStyle(T.faint)
            }
            .padding(.horizontal, 10).padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: T.R.md).fill(T.fieldBg))
            .overlay(RoundedRectangle(cornerRadius: T.R.md).stroke(T.hairline, lineWidth: 1))
        }
    }

    var quickRow: some View {
        HStack(spacing: 8) {
            ForEach(quickTimes, id: \.self) { t in
                Button {
                    hour = t / 60; minute = t % 60; error = nil
                } label: {
                    Text(String(format: "%02d:%02d", t / 60, t % 60))
                        .font(F.sans(12, .medium))
                        .foregroundStyle(T.chipInk)
                        .padding(.horizontal, 11).padding(.vertical, 6)
                        .background(Capsule().fill(T.chipBg))
                }
                .buttonStyle(.plain)
            }
            Spacer()
        }
    }
    var quickTimes: [Int] {
        let h = DT.cal.component(.hour, from: .now)
        return h < 12 ? [9 * 60, 18 * 60] : [14 * 60, 20 * 60]
    }

    var footer: some View {
        HStack(spacing: 10) {
            GhostButton(title: "清除") { date = nil; onDone() }
            GhostButton(title: "取消") { onDone() }
            PrimaryButton(title: "确定") { confirm() }
        }
        .padding(.horizontal, 20).padding(.vertical, 14)
        .background(T.paper.overlay(alignment: .top) { Rectangle().fill(T.hairline).frame(height: 1) })
    }

    func confirm() {
        guard let day = selectedDay else { onDone(); return }
        let dt = DT.cal.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
        if dt < .now {
            error = "不能选择当前时间之前"
            return
        }
        date = dt
        onDone()
    }
}