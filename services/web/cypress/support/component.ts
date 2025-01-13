import 'cypress-plugin-tab'
import { resetMeta } from './ct/window' // needs to be before i18n
import '@/i18n'
import './shared/commands'
import './shared/exceptions'
import './ct/commands'
import './ct/codemirror'

beforeEach(function () {
  resetMeta()
})
