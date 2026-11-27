import Foundation

enum DT {
    static var cal: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.firstWeekday = 2 // 周一开头
        c.locale = Locale(identifier: "zh_CN")
        return c
    }()

    static func startOfDay(_ d: Date) -> Date { cal.startOfDay(for: d) }
    static func isToday(_ d: Date, _ now: Date = .now) -> Bool { cal.isDate(d, inSameDayAs: now) }
    static func isTomorrow(_ d: Date, _ now: Date = .now) -> Bool {
        cal.isDate(d, inSameDayAs: cal.date(byAdding: .day, value: 1, to: now)!)
    }
    static func dayDiff(_ d: Date, _ now: Date = .now) -> Int {
        cal.dateComponents([.day], from: startOfDay(now), to: startOfDay(d)).day ?? 0
    }

    static func timeText(_ d: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "HH:mm"
        return f.string(from: d)
    }

    // 到期主文案：今天 10:00 / 明天 09:00 / 11月30日 09:00
    static func dueText(_ due: Date, _ now: Date = .now) -> String {
        let t = timeText(due)
        if isToday(due, now) { return "今天 \(t)" }
        if isTomorrow(due, now) { return "明天 \(t)" }
        let diff = dayDiff(due, now)
        if diff > 1 && diff < 7 {
            let wd = cal.component(.weekday, from: due)
            let names = ["日","一","二","三","四","五","六"]
            return "周\(names[wd - 1]) \(t)"
        }
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN"); f.dateFormat = "M月d日"
        return "\(f.string(from: due)) \(t)"
    }

    // 逾期时长文案
    static func overdueText(_ due: Date, _ now: Date = .now) -> String {
        let mins = Int(now.timeIntervalSince(due) / 60)
        if mins < 60 { return "已逾期 \(max(mins, 1)) 分钟" }
        let hours = mins / 60
        if hours < 24 { return "已逾期 \(hours) 小时" }
        let days = hours / 24
        return "已逾期 \(days) 天"
    }

    static func fullDate(_ d: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "zh_CN")
        f.dateFormat = "yyyy年M月d日 EEEE"
        return f.string(from: d)
    }

    static func greeting(_ now: Date = .now) -> String {
        let h = cal.component(.hour, from: now)
        switch h {
        case 5..<11: return "早上好"
        case 11..<14: return "中午好"
        case 14..<18: return "下午好"
        default: return "晚上好"
        }
    }
}

struct QuickParse {
    var title: String
    var due: Date?
    var priority: Priority = .none
    var tags: [String] = []
}

enum QuickAdd {
    static func parse(_ raw: String, knownTags: [String], now: Date = .now) -> QuickParse {
        var text = raw
        var due: Date? = nil
        var prio: Priority = .none
        var tags: [String] = []

        // 标签 #xxx
        if let re = try? NSRegularExpression(pattern: "#([^\\s#]+)") {
            let matches = re.matches(in: text, range: NSRange(text.startIndex..., in: text))
            for m in matches.reversed() {
                if let r = Range(m.range(at: 1), in: text) {
                    let tag = String(text[r])
                    tags.append(tag)
                }
                if let full = Range(m.range, in: text) { text.removeSubrange(full) }
            }
        }
        // 优先级 !高/!中/!低 或 !p1..3
        if let re = try? NSRegularExpression(pattern: "!([^\\s!]+)") {
            let matches = re.matches(in: text, range: NSRange(text.startIndex..., in: text))
            for m in matches.reversed() {
                if let r = Range(m.range(at: 1), in: text) {
                    let v = String(text[r])
                    switch v {
                    case "高","p1","1": prio = .high
                    case "中","p2","2": prio = .med
                    case "低","p3","3": prio = .low
                    default: break
                    }
                }
                if let full = Range(m.range, in: text) { text.removeSubrange(full) }
            }
        }
        // 时间 HH:mm
        var hour: Int? = nil, minute = 0
        if let re = try? NSRegularExpression(pattern: "(\\d{1,2}):(\\d{2})") {
            if let m = re.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
               let hr = Range(m.range(at: 1), in: text), let mr = Range(m.range(at: 2), in: text) {
                hour = Int(text[hr]); minute = Int(text[mr]) ?? 0
                if let full = Range(m.range, in: text) { text.removeSubrange(full) }
            }
        }
        // 日期词
        var dayOffset: Int? = nil
        let dayWords: [(String, Int)] = [("今天",0),("明天",1),("后天",2)]
        for (w, off) in dayWords where text.contains(w) {
            dayOffset = off
            text = text.replacingOccurrences(of: w, with: "")
            break
        }
        if dayOffset == nil {
            let wdNames = ["日","一","二","三","四","五","六"]
            for (i, name) in wdNames.enumerated() {
                let key = "周\(name)"
                if let r = text.range(of: key) {
                    let targetWd = i + 1
                    let curWd = DT.cal.component(.weekday, from: now)
                    var delta = targetWd - curWd
                    if delta <= 0 { delta += 7 }
                    dayOffset = delta
                    text.removeSubrange(r)
                    break
                }
            }
        }
        if let off = dayOffset {
            var base = DT.cal.date(byAdding: .day, value: off, to: DT.startOfDay(now))!
            if let h = hour {
                base = DT.cal.date(bySettingHour: min(h,23), minute: min(minute,59), second: 0, of: base) ?? base
            } else {
                base = DT.cal.date(bySettingHour: 9, minute: 0, second: 0, of: base) ?? base
            }
            due = base
        } else if let h = hour {
            var base = DT.cal.date(bySettingHour: min(h,23), minute: min(minute,59), second: 0, of: now) ?? now
            if base < now { base = DT.cal.date(byAdding: .day, value: 1, to: base) ?? base }
            due = base
        }

        let title = text.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "  ", with: " ")
        return QuickParse(title: title, due: due, priority: prio, tags: tags.reversed())
    }
}