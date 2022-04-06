// eslint-disable-next-line no-unused-vars
declare namespace Cypress {
  // eslint-disable-next-line no-unused-vars
  interface Chainable {
    interceptCompile(prefix?: string): void
    interceptEvents(): void
  }
}
