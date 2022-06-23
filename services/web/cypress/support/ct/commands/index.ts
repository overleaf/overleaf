import { mount, unmount } from '@cypress/react'

// eslint-disable-next-line no-unused-vars,@typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace,no-unused-vars
  namespace Cypress {
    // eslint-disable-next-line no-unused-vars
    interface Chainable {
      mount: typeof mount
      unmount: typeof unmount
    }
  }
}

Cypress.Commands.add('mount', mount)
Cypress.Commands.add('unmount', unmount)
