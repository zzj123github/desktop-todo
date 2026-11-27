import SwiftUI

struct SheetHeader: View {
    var title: String
    var onClose: () -> Void
    var body: some View {
        HStack {
            Text(title).font(F.serif(20)).foregroundStyle(T.ink)
            Spacer()
            Button(action: onClose) {
                Image(systemName: "xmark")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(T.icon)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(T.chipBg))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 20)
        .padding(.top, 16)
        .padding(.bottom, 8)
    }
}

struct PrimaryButton: View {
    var title: String
    var disabled: Bool = false
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(F.sans(15, .semibold))
                .foregroundStyle(T.onAccent)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: T.R.lg).fill(disabled ? T.faint : T.accent))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

struct GhostButton: View {
    var title: String
    var action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(title)
                .font(F.sans(15, .medium))
                .foregroundStyle(T.ink2)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(RoundedRectangle(cornerRadius: T.R.lg).fill(T.chipBg))
        }
        .buttonStyle(.plain)
    }
}

struct FieldLabel: View {
    var text: String
    var body: some View {
        Text(text).font(F.sans(12, .semibold)).foregroundStyle(T.muted)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct HairlineBox<Content: View>: View {
    @ViewBuilder var content: Content
    var body: some View {
        content
            .padding(.horizontal, 12).padding(.vertical, 10)
            .background(RoundedRectangle(cornerRadius: T.R.md).fill(T.fieldBg))
            .overlay(RoundedRectangle(cornerRadius: T.R.md).stroke(T.hairline, lineWidth: 1))
    }
}

// 选择器行 chip 按钮
struct SelectorChip: View {
    var icon: String
    var text: String
    var active: Bool = false
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 11))
            Text(text).font(F.sans(13, active ? .semibold : .regular))
        }
        .foregroundStyle(active ? T.accentDeep : T.chipInk)
        .padding(.horizontal, 11).padding(.vertical, 7)
        .background(RoundedRectangle(cornerRadius: T.R.md).fill(active ? T.accentSoft : T.chipBg))
        .overlay(RoundedRectangle(cornerRadius: T.R.md).stroke(active ? T.chipSelBd : T.hairline, lineWidth: 1))
    }
}