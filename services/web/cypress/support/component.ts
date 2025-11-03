import 'cypress-plugin-tab'
import { resetMeta } from './ct/window' // needs to be before i18n
import localesPromise from '@/i18n'
import './shared/commands'
import './shared/exceptions'
import './ct/commands'
import '../../test/frontend/helpers/bootstrap'

beforeEach(function () {
  cy.wrap(localesPromise).then(resetMeta)
})
