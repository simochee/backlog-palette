/**
 * 部品と container が共有する文言の辞書。ドメイン語（ステータス名・プロジェクト名）は
 * 含めない。Backlog が返す値をそのまま props で渡す。
 */
export type Labels = {
  brand: string;
  palette: {
    inputLabel: string;
    placeholder: string;
    listLabel: string;
    escClose: string;
    escBack: string;
    armedNotice: string;
    rootScope: string;
    rootPlaceholder: string;
  };
  keys: {
    open: string;
    search: string;
    apply: string;
    connect: string;
    newTab: string;
    move: string;
    back: string;
    backArmed: (segment: string) => string;
    complete: string;
    stack: string;
    descend: string;
    copyUrl: string;
    toPanel: string;
  };
  sections: {
    recent: string;
    spaces: string;
    commonPages: string;
    pagesOf: (project: string) => string;
    assigned: string;
    results: string;
    pages: string;
    projects: string;
    /** 課題キー入力時に前方一致する課題を並べるセクション */
    issues: string;
    commands: string;
    learned: string;
    more: (count: number) => string;
    loading: (space: string) => string;
    countOf: (space: string, count: number) => string;
    count: (count: number) => string;
    summary: (spaces: number, count: number) => string;
  };
  rows: {
    searchFor: (query: string) => string;
    searchSub: (scope: string) => string;
    searching: string;
    openDirect: string;
    recentSub: string;
    pageSub: string;
    projectSub: (key: string) => string;
    updatedBy: (person: string) => string;
    commonPageSub: string;
    personalSettings: string;
    apiKeySettings: string;
    spaceSettings: string;
    typeHint: string;
    connectThis: string;
    connectSpace: (space: string) => string;
    authExpired: (space: string) => string;
    rateLimited: (space: string, seconds: number) => string;
    offline: string;
    pending: (count: number) => string;
    noResults: string;
    widenTo: (scope: string) => string;
    toPanel: string;
    toPanelSub: string;
    openExternal: string;
    moreExternal: (count: number) => string;
    copied: (subject: string) => string;
    copyIssueKey: string;
    copyIssueUrl: string;
    copyIssueTitle: string;
    copyIssueMarkdown: string;
    switchSpace: string;
  };
  panel: {
    title: string;
    inputLabel: string;
    placeholder: string;
    recent: string;
    filtersLabel: string;
    singleChoice: string;
    clearFilters: string;
    reconnect: string;
    loading: string;
    statusLabel: string;
    clearFiltersRow: string;
    fields: {
      space: string;
      project: string;
      type: string;
      status: string;
      assignee: string;
      updated: string;
    };
    options: {
      all: string;
      allSpaces: string;
      notClosed: string;
      me: string;
      unassigned: string;
      anyTime: string;
      week: string;
      month: string;
      quarter: string;
      issue: string;
      wiki: string;
      document: string;
    };
    authExpired: string;
  };
  connect: {
    title: string;
    inputLabel: string;
    placeholder: string;
    submit: string;
    submitting: string;
    doneTitle: (space: string) => string;
    close: string;
    invalidKey: string;
    failed: string;
  };
  options: {
    spacesTitle: string;
    spacesEmpty: string;
    reconnect: string;
    disconnect: string;
    confirmDisconnect: string;
    projects: (count: number) => string;
    lastSync: (when: string) => string;
    connected: string;
    needsReconnect: string;
    customDomain: {
      title: string;
      description: string;
      inputLabel: string;
      placeholder: string;
      add: string;
      invalid: string;
      remove: string;
      empty: string;
    };
  };
};
