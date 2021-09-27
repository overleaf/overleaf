import './utils/webpack-public-path'
import 'jquery'
import 'bootstrap'
import './features/form-helpers/hydrate-form'
import './features/link-helpers/slow-link'
import './features/contact-form'
import './features/event-tracking'
import './features/multi-submit'

$('[data-ol-lang-selector-tooltip]').tooltip({ trigger: 'hover' })
