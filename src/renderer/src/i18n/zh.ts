/**
 * i18n · 中文文案
 * Contract: docs/08-UI-ENGINEERING-SPEC.md §4（文案集中存放，组件内不散落中文字符串）
 * 所有面向用户的界面文案都在这里；日期/时长等动态格式化在 lib/date.ts。
 */

export const zh = {
  app: {
    name: '桌面待办',
    version: 'v1.0',
    windowTitle: '桌面待办'
  },

  nav: {
    inbox: '收件箱',
    today: '今天',
    overdue: '已逾期',
    upcoming: '即将到期',
    done: '已完成',
    projects: '项目',
    tags: '标签',
    settings: '设置',
    help: '使用说明',
    manageProjects: '管理项目',
    manageTags: '管理标签',
    manageAll: '管理项目与标签',
    views: '桌面视图'
  },

  viewMeta: {
    today: (count: number, overdue: number) =>
      overdue > 0 ? `${count} 项待办 · ${overdue} 项逾期` : `${count} 项待办`,
    inbox: (count: number) => `未安排日期、未归项目 · ${count} 项待处理`,
    overdue: (count: number) => `共 ${count} 项 · 逾期越久越靠前`,
    upcoming: (count: number) => `未来 7 天 · ${count} 项`,
    done: (count: number) => `最近完成 · ${count} 项`,
    project: (count: number) => `项目 · ${count} 项待办`,
    tag: (count: number) => `标签 · ${count} 项待办`,
    saved: (count: number) => `桌面视图 · ${count} 项`
  },

  groups: {
    todo: '待办',
    done: '已完成'
  },

  tabs: {
    all: '全部',
    todo: '待办',
    done: '已完成'
  },

  composer: {
    placeholder: '添加任务，回车保存…',
    placeholderWidget: '添加今天要做的事…',
    send: '添加',
    due: '日期',
    tags: '标签',
    priority: '优先级',
    links: '链接',
    noDate: '无日期',
    todayAt: '今天 18:00',
    tomorrowAt: '明天 18:00',
    todayPrefix: '今天 ',
    tomorrowPrefix: '明天 ',
    specify: '指定日期…',
    clear: '清除',
    done: '完成',
    linkPlaceholder: '粘贴链接或本地路径…',
    addLink: '添加'
  },

  priority: {
    none: '无',
    high: '高',
    medium: '中',
    low: '低',
    label: '优先级'
  },

  filter: {
    status: '状态',
    statusTodo: '待办',
    statusDone: '已完成',
    statusAll: '全部',
    date: '日期',
    byProject: '按项目',
    byTag: '按标签',
    byDate: '按日期',
    byPriority: '按优先级',
    multiHint: '可多选',
    customDate: '指定日期',
    anyDate: '任意日期',
    today: '今天',
    tomorrow: '明天',
    week: '本周',
    overdue: '已逾期',
    custom: '自定义日期',
    tags: '标签',
    priority: '优先级',
    reset: '重置',
    apply: '应用',
    searchPlaceholder: '搜索标题或备注',
    clearAll: '清除筛选',
    saveView: '保存为桌面视图',
    noFilterToSave: '先设置筛选条件再保存',
    noTags: '还没有项目或标签',
    clear: '清除',
    searchAria: '搜索任务',
    searchTitle: '搜索 (Ctrl+F)',
    closeSearch: '关闭搜索',
    keywordChip: (keyword: string) => `关键词「${keyword}」`
  },

  widget: {
    title: '今天',
    dragHint: '拖动此区域移动挂件',
    pinOn: '取消置顶',
    pinOff: '置顶挂件',
    collapse: '收起为胶囊',
    expand: '展开挂件',
    footerTip: '双击空白处快速新增',
    emptyTitle: '今天没有待办',
    emptyBody: '在下面的输入框里加一条，回车就保存。',
    doneSummary: (done: number, total: number) => `${done}/${total} 已完成`,
    doneGroup: '已完成',
    doneEmpty: '暂无',
    capsuleNoTask: '今天还没有安排',
    capsuleDone: '今天的任务已完成',
    capsuleOverdue: (count: number) => `${count} 项逾期`,
    capsuleSub: (title: string, time: string) => `${title} · ${time}`,
    addTask: '添加任务'
  },

  manager: {
    newTask: '新建',
    search: '搜索',
    emptyTitle: '这里还没有任务',
    emptyBody: '在下面的输入框里加一条，回车就保存。',
    emptyFilteredTitle: '没有符合条件的任务',
    emptyFilteredBody: '换个筛选条件，或清除筛选看看全部任务。',
    emptyDoneTitle: '还没有完成的任务',
    emptyDoneBody: '勾掉一条任务，它会出现在这里。',
    doubleClickTip: '双击空白处快速新增',
    overflowTip: '更多…',
    collapseToWidget: '收起到挂件',
    collapseToCapsule: '收起到胶囊',
    noViews: '还没有保存的桌面视图',
    viewNamePlaceholder: '视图名称'
  },

  editor: {
    title: '编辑任务',
    createdTitle: '新建任务',
    titleLabel: '标题',
    titlePlaceholder: '任务标题',
    noteLabel: '备注',
    notePlaceholder: '补充说明（可选）',
    projectLabel: '项目',
    noProject: '无项目',
    newProject: '+ 新建项目',
    projectPlaceholder: '项目名称',
    tagsLabel: '标签',
    newTag: '+ 新建标签',
    tagPlaceholder: '标签名称',
    priorityLabel: '优先级',
    dueLabel: '日期',
    linksLabel: '链接',
    linkPlaceholder: '粘贴链接、文件夹路径或拖入文件',
    addLink: '添加',
    emptyLinks: '还没有链接',
    linkTitleLabel: '链接标题',
    linkTitleEdit: '点击编辑标题',
    linkTitlePlaceholder: '链接标题（留空自动生成）',
    dropHint: '把文件 / 文件夹拖到这里，或粘贴路径',
    dropHintSub: '拖入后自动识别为文件、文件夹或网址',
    remove: '删除',
    moveUp: '上移',
    moveDown: '下移',
    save: '保存',
    cancel: '取消',
    close: '关闭',
    deleteTask: '删除任务',
    confirmDelete: '确认删除',
    notFound: '找不到该位置',
    relocate: '重新选择',
    open: '打开',
    titleRequired: '标题不能为空',
    chooseFile: '重新选择文件或文件夹'
  },

  settings: {
    title: '设置',
    alwaysOnTop: '桌面挂件置顶',
    alwaysOnTopDesc: '其他窗口之上保持可见',
    opacity: '失焦透明度',
    opacityDesc: '挂件失去焦点时的显示透明度',
    launchAtLogin: '开机自动启动',
    launchAtLoginDesc: '登录 Windows 后自动在托盘运行',
    shortcuts: '全局快捷键',
    shortcutsDesc: 'Alt+H 显隐挂件 · Alt+1–5 切换视图 · Ctrl+Shift+Space 快速添加',
    data: '数据',
    dataDir: '数据目录',
    openDataDir: '打开所在文件夹',
    exportData: '导出数据',
    importData: '导入数据',
    exportHint: '导出为 JSON 备份文件',
    importHint: '导入会覆盖当前全部数据',
    importConfirmTitle: '导入数据？',
    importConfirmBody: '导入会覆盖当前全部任务、项目、标签、筛选和设置。建议先导出备份。',
    importConfirmAction: '覆盖导入',
    exportOk: '已导出备份',
    importOk: (n: number) => `已导入 ${n} 条任务`,
    manageScope: '项目与标签',
    manageScopeDesc: '重命名、删除或新建',
    manage: '管理',
    about: '关于',
    aboutVersion: (v: string) => `桌面待办 ${v}`,
    aboutBody: '本地任务管理 · Electron + SQLite',
    done: '完成'
  },

  help: {
    title: '使用说明',
    close: '知道了',
    sections: [
      {
        title: '三种形态',
        items: [
          '挂件：桌面常驻的任务清单，默认显示今天；双击标题打开完整窗口。',
          '胶囊：点挂件右上角「—」收起，单击展开、双击打开完整窗口。',
          '完整窗口：标题行的「收起到挂件」「收起到胶囊」可切换形态；同一时刻只显示一种。',
          '挂件与胶囊共用位置：切换或改变高度时，按最近的屏幕角（默认右上）保持位置。'
        ]
      },
      {
        title: '添加与编辑任务',
        items: [
          '底部输入框输入标题，回车保存；Shift+回车换行。',
          '输入里可以直接写「明天 10:00」「#标签」「高/中/低」，保存时自动识别。',
          '点击任务行打开编辑窗口，可修改标题、备注、项目、标签、优先级、日期与链接。'
        ]
      },
      {
        title: '链接',
        items: [
          '支持网页 / 文件夹 / UNC 共享路径 / 本地文件，粘贴或拖入即可添加。',
          '链接标题默认自动生成，点击标题可修改；留空则恢复自动标题。',
          '找不到位置时点「重新选择」定位，或删除该链接。'
        ]
      },
      {
        title: '筛选与桌面视图',
        items: [
          '五个维度：标签、日期、优先级、状态、关键词，条件即时生效。',
          '标题旁的箭头可把当前筛选保存为桌面视图，之后一键切换。'
        ]
      },
      {
        title: '快捷键',
        items: [
          'Ctrl+Shift+Space：快速添加（需开启全局快捷键）。',
          'Alt+H：显示 / 隐藏挂件；Alt+1…5：切换到收件箱 / 今天 / 已逾期 / 即将到期 / 已完成。',
          'Ctrl+N：新建任务；Ctrl+F：搜索；Esc：关闭浮层或收起挂件。'
        ]
      },
      {
        title: '数据与设置',
        items: [
          '设置里可调整置顶、失焦透明度、开机自启与全局快捷键。',
          '可查看数据目录、导出备份，或用导入恢复。'
        ]
      }
    ]
  },

  manage: {
    titleAll: '管理项目与标签',
    titleProjects: '管理项目',
    titleTags: '管理标签',
    subtitle: '重命名、删除或新建',
    subtitleProjects: '重命名、删除或新建项目',
    subtitleTags: '重命名、删除或新建标签',
    projectsSection: '项目',
    tagsSection: '标签',
    emptyProjects: '还没有项目，在下面新建一个。',
    emptyTags: '还没有标签，在下面新建一个。',
    pendingCount: (n: number) => `${n} 项待办`,
    noPending: '无待办',
    rename: '重命名',
    delete: '删除',
    addProject: '+ 新建项目',
    addTag: '+ 新建标签',
    namePlaceholder: '名称',
    create: '创建',
    cancel: '取消',
    duplicate: '名称已存在',
    emptyName: '名称不能为空',
    help: '项目用于归属任务，标签用于交叉标记；删除后可在底部提示里撤销。',
    close: '关闭'
  },

  deleteConfirm: {
    projectTitle: (name: string) => `删除项目「${name}」？`,
    tagTitle: (name: string) => `删除标签「${name}」？`,
    projectStats: (total: number, pending: number, done: number) =>
      `该项目下还有 ${total} 项任务（待办 ${pending} · 已完成 ${done}）。`,
    tagStats: (total: number, pending: number, done: number) =>
      `该标签下还有 ${total} 项任务（待办 ${pending} · 已完成 ${done}）。`,
    projectBody: '删除项目不会删除任务，任务会变成「无项目」；删除后可在底部提示里撤销。',
    tagBody: '删除标签不会删除任务，只会去掉这个标签；删除后可在底部提示里撤销。',
    cancel: '取消',
    confirmProject: '删除项目',
    confirmTag: '删除标签',
    close: '关闭'
  },

  datePicker: {
    emptyDateTime: '选择日期时间',
    emptyDate: '选择日期',
    time: '时间',
    hour: '时',
    minute: '分',
    prevMonth: '上个月',
    nextMonth: '下个月',
    clear: '清除',
    cancel: '取消',
    confirm: '确定',
    quick: '快捷时间',
    pastTime: '不能选择当前时间之前',
    pastQuick: '这个时间已经过去了，选一个之后的',
    weekdays: ['一', '二', '三', '四', '五', '六', '日'] as const,
    monthSuffix: '月',
    yearSuffix: '年'
  },

  toast: {
    undo: '撤销',
    close: '关闭提示',
    taskAdded: (title: string) => `已添加「${title}」`,
    taskDone: (title: string) => `已完成「${title}」`,
    taskRestored: (title: string) => `已恢复「${title}」`,
    taskDeleted: (title: string) => `已删除「${title}」`,
    taskUpdated: '任务已更新',
    projectCreated: (name: string) => `已新建项目「${name}」`,
    tagCreated: (name: string) => `已新建标签「${name}」`,
    renamed: '已重命名',
    projectDeleted: (name: string) => `已删除项目「${name}」`,
    tagDeleted: (name: string) => `已删除标签「${name}」`,
    viewSaved: (name: string) => `已保存桌面视图「${name}」`,
    viewRenamed: '桌面视图已重命名',
    viewDeleted: (name: string) => `已删除桌面视图「${name}」`,
    linkAdded: '已添加链接',
    linkRemoved: '已删除链接',
    linkMissing: '找不到该位置',
    openFailed: '打不开这个位置',
    duplicate: '名称已存在',
    emptyName: '名称不能为空',
    renamedShortcutFailed: '全局快捷键注册失败，可在设置里关闭',
    exported: '已导出备份',
    imported: (n: number) => `已导入 ${n} 条任务`,
    dataReset: '数据已重置',
    viewActions: '更多'
  },

  notice: {
    ack: '知道了'
  },

  common: {
    save: '保存',
    cancel: '取消',
    close: '关闭',
    delete: '删除',
    rename: '重命名',
    create: '创建',
    add: '添加',
    remove: '移除',
    open: '打开',
    reset: '重置',
    apply: '应用',
    confirm: '确定',
    done: '完成',
    edit: '编辑',
    more: '更多',
    task: '任务',
    link: '链接',
    project: '项目',
    tag: '标签',
    noProject: '无项目',
    untitled: '未命名任务',
    today: '今天',
    tomorrow: '明天',
    yesterday: '昨天',
    overdue: '逾期',
    doneLabel: '已完成',
    loading: '加载中…',
    error: '出错了',
    retry: '重试'
  },

  aria: {
    taskCheckbox: (title: string, done: boolean) => (done ? `取消完成「${title}」` : `完成「${title}」`),
    openLink: (name: string) => `打开链接「${name}」`,
    editLinkTitle: (name: string) => `编辑链接标题「${name}」`,
    removeLink: (name: string) => `删除链接「${name}」`,
    expandGroup: (name: string) => `展开${name}`,
    collapseGroup: (name: string) => `收起${name}`,
    navItem: (name: string, count: number) => `${name}，${count} 项`,
    progress: (percent: number) => `完成进度 ${percent}%`,
    manageEntry: (kind: string) => `管理${kind}`
  }
} as const

export type Zh = typeof zh
