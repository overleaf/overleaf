declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    sl_debugging: boolean
    user: {
      id: string
    }
    metaAttributesCache: Map<string, unknown>
    i18n: {
      currentLangCode: string
    }
    ExposedSettings: Record<string, unknown>
  }
}
export {} // pretend this is a module
