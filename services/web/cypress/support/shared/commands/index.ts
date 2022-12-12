import '@testing-library/cypress/add-commands'
import { interceptCompile } from './compile'
import { interceptEvents } from './events'
import { interceptSpelling } from './spelling'

// eslint-disable-next-line no-unused-vars,@typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace,no-unused-vars
  namespace Cypress {
    // eslint-disable-next-line no-unused-vars
    interface Chainable {
      interceptCompile: typeof interceptCompile
      interceptEvents: typeof interceptEvents
      interceptSpelling: typeof interceptSpelling
    }
  }
}

Cypress.Commands.add('interceptCompile', interceptCompile)
Cypress.Commands.add('interceptEvents', interceptEvents)
Cypress.Commands.add('interceptSpelling', interceptSpelling)
