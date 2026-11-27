import SwiftUI

// 设计 token 1:1 映射自 desktop-todo/design/ui/tokens.css（dsh-claude-style）。
// 暖纸底、陶土橙唯一强调、无纯黑白、无冷灰。
extension Color {
    init(hex: UInt, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

enum T {
    // 表面与文字
    static let canvas   = Color(hex: 0xF9F6EE)
    static let paper    = Color(hex: 0xFAF8F2)
    static let card     = Color(hex: 0xFFFDFA)
    static let sidebar  = Color(hex: 0xF0EDE3)
    static let ink      = Color(hex: 0x1F1E1D)
    static let ink2     = Color(hex: 0x54514A)
    static let muted    = Color(hex: 0x8B8474)
    static let faint    = Color(hex: 0xA8A18F)
    static let hairline = Color(hex: 0xE6E0D2)
    static let hairSoft = Color(hex: 0xF0ECE2)

    // 强调（唯一）
    static let accent      = Color(hex: 0xD97757)
    static let accentDeep  = Color(hex: 0xC4553B)
    static let accentSoft  = Color(hex: 0xFBEAE2)
    static let accentHover = Color(hex: 0xD26A48)
    static let onAccent    = Color(hex: 0xFFFDFA)

    static let link    = Color(hex: 0x184F95)
    static let success = Color(hex: 0x7F9A6D)

    static let hover    = Color(hex: 0x1F1E1D, alpha: 0.045)
    static let selected = Color(hex: 0x1F1E1D, alpha: 0.065)

    static let borderFocus = Color(hex: 0xCFC6B4)
    static let chipBg      = Color(hex: 0xF1EEE5)
    static let chipInk     = Color(hex: 0x6B6557)
    static let chipTagBg   = Color(hex: 0xF4F1E8)
    static let chipSelBd   = Color(hex: 0xF2D3C6)
    static let fieldBg     = Color(hex: 0xFCFAF4)
    static let checkBorder = Color(hex: 0xD9D2C2)
    static let icon        = Color(hex: 0x7B7466)
    static let tabBg       = Color(hex: 0xF0ECE2)

    static let prioHigh = accent
    static let prioMed  = Color(hex: 0xB98A3C)
    static let prioLow  = Color(hex: 0x7F9A6D)

    static let toastBg  = Color(hex: 0x2B271F)
    static let toastInk = Color(hex: 0xF7F2E6)
    static let ringTrack = Color(hex: 0xEBE5D8)
    static let ringLabel = Color(hex: 0x6F695B)

    // 圆角
    enum R {
        static let xs: CGFloat = 4
        static let chip: CGFloat = 4.5
        static let sm: CGFloat = 6
        static let md: CGFloat = 8
        static let lg: CGFloat = 12
        static let xl: CGFloat = 14
        static let xxl: CGFloat = 16
        static let sheet: CGFloat = 18
    }
}

// 字体：UI 用系统 sans（近似 InterVariable）；仅展示级大标题用 serif。
enum F {
    static func sans(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .default)
    }
    static func serif(_ size: CGFloat, _ weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }
}

