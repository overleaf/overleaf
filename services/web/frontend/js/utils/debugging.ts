/* eslint-disable no-console */
type DebugConsole = {
  debug(...data: any[]): void
  log(...data: any[]): void
  warn(...data: any[]): void
  error(...data: any[]): void
}

export const debugging =
  new URLSearchParams(window.location.search).get('debug') === 'true'
export const debugConsole: DebugConsole = debugging
  ? console
  : { debug() {}, log() {}, warn: console.warn, error: console.error }
