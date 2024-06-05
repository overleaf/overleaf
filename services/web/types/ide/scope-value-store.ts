export interface ScopeValueStore {
  // We can't make this generic because get() can always return undefined if
  // there is no entry for the path
  get: (path: string) => any
  set: (path: string, value: unknown) => void
  watch: <T>(path: string, callback: (newValue: T) => void) => () => void
}
