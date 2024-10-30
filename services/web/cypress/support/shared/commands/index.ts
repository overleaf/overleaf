import '@testing-library/cypress/add-commands'
import {
  interceptCompile,
  waitForCompile,
  interceptDeferredCompile,
} from './compile'
import { interceptEvents } from './events'
import { interceptAsync } from './intercept-async'
import { interceptFileUpload } from './upload'
import { interceptProjectListing } from './project-list'
import { interceptLinkedFile } from './linked-file'
import { interceptMathJax } from './mathjax'
import { interceptMetadata } from './metadata'
import { interceptTutorials } from './tutorials'

// eslint-disable-next-line no-unused-vars,@typescript-eslint/no-namespace
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace,no-unused-vars
  namespace Cypress {
    // eslint-disable-next-line no-unused-vars
    interface Chainable {
      interceptAsync: typeof interceptAsync
      interceptCompile: typeof interceptCompile
      interceptEvents: typeof interceptEvents
      interceptMetadata: typeof interceptMetadata
      waitForCompile: typeof waitForCompile
      interceptDeferredCompile: typeof interceptDeferredCompile
      interceptFileUpload: typeof interceptFileUpload
      interceptProjectListing: typeof interceptProjectListing
      interceptLinkedFile: typeof interceptLinkedFile
      interceptMathJax: typeof interceptMathJax
      interceptTutorials: typeof interceptTutorials
    }
  }
}

Cypress.Commands.add('interceptAsync', interceptAsync)
Cypress.Commands.add('interceptCompile', interceptCompile)
Cypress.Commands.add('interceptEvents', interceptEvents)
Cypress.Commands.add('interceptMetadata', interceptMetadata)
Cypress.Commands.add('waitForCompile', waitForCompile)
Cypress.Commands.add('interceptDeferredCompile', interceptDeferredCompile)
Cypress.Commands.add('interceptFileUpload', interceptFileUpload)
Cypress.Commands.add('interceptProjectListing', interceptProjectListing)
Cypress.Commands.add('interceptLinkedFile', interceptLinkedFile)
Cypress.Commands.add('interceptMathJax', interceptMathJax)
Cypress.Commands.add('interceptTutorials', interceptTutorials)
