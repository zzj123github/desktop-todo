import Foundation

enum Priority: Int, Codable, CaseIterable, Identifiable {
    case none = 0, low = 1, med = 2, high = 3
    var id: Int { rawValue }
    var label: String {
        switch self {
        case .none: return "无"
        case .low: return "低"
        case .med: return "中"
        case .high: return "高"
        }
    }
}