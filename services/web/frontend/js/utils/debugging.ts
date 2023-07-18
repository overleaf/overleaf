type DebugConsole = { log(...data: any[]): void }

export const debugging =
  new URLSearchParams(window.location.search).get('debug') === 'true'
export const debugConsole: DebugConsole = debugging
  ? console
  : { log: () => {} }
