import SwiftUI
import SwiftData

enum AppTab: Hashable { case today, views, done, settings }

struct RootView: View {
    @Environment(\.modelContext) private var context
    @State private var tab: AppTab = .today
    @State private var showAdd = false
    @StateObject private var toast = ToastCenter()
    @State private var didSeed = false

    var body: some View {
        ZStack(alignment: .bottom) {
            content
                .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
            ToastView().environmentObject(toast)
        }
        .background(T.canvas.ignoresSafeArea())
        .environmentObject(toast)
        .sheet(isPresented: $showAdd) {
            AddSheet().environmentObject(toast)
        }
        .onAppear {
            if !didSeed { Seed.populateIfNeeded(context); didSeed = true }
            WidgetSync.refresh(context)
            switch UserDefaults.standard.string(forKey: "startTab") {
            case "views": tab = .views
            case "done": tab = .done
            case "settings": tab = .settings
            default: break
            }
            if UserDefaults.standard.bool(forKey: "autoAdd") { showAdd = true }
        }
        .preferredColorScheme(.light)
        .tint(T.accent)
    }

    @ViewBuilder var content: some View {
        switch tab {
        case .today: TodayView()
        case .views: ViewsView()
        case .done: DoneView()
        case .settings: SettingsView()
        }
    }

    var tabBar: some View {
        HStack(alignment: .bottom, spacing: 0) {
            tabButton(.today, title: "今天", icon: "sun.max")
            tabButton(.views, title: "视图", icon: "square.grid.2x2")
            addButton
            tabButton(.done, title: "已完成", icon: "checkmark.circle")
            tabButton(.settings, title: "设置", icon: "gearshape")
        }
        .padding(.horizontal, 8)
        .padding(.top, 8)
        .padding(.bottom, 6)
        .background(
            T.paper
                .overlay(alignment: .top) { Rectangle().fill(T.hairline).frame(height: 1) }
                .ignoresSafeArea(edges: .bottom)
        )
    }

    func tabButton(_ t: AppTab, title: String, icon: String) -> some View {
        let active = tab == t
        return Button {
            Haptic.soft(); tab = t
        } label: {
            VStack(spacing: 3) {
                Image(systemName: active ? icon + ".fill" : icon)
                    .font(.system(size: 19))
                    .symbolVariant(.none)
                Text(title).font(F.sans(10, active ? .semibold : .regular))
            }
            .foregroundStyle(active ? T.accent : T.muted)
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    var addButton: some View {
        Button {
            Haptic.light(); showAdd = true
        } label: {
            Image(systemName: "plus")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(T.onAccent)
                .frame(width: 46, height: 46)
                .background(Circle().fill(T.accent))
                .offset(y: -14)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}