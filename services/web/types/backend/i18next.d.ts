import 'i18next'

// Add our custom translate function from Translations.js into the i18next i18n
// object type definition
declare module 'i18next' {
  // eslint-disable-next-line no-unused-vars
  interface i18n {
    translate(key: string, vars?: Record<string, any>, components?: any): string
  }
}
