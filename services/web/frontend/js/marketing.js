import './utils/webpack-public-path'
import './infrastructure/error-reporter'
import 'jquery'
import 'bootstrap'
import './cdn-load-test'
import './features/form-helpers/hydrate-form'
import './features/link-helpers/slow-link'
import './features/bookmarkable-tab'
import './features/contact-form'
import './features/event-tracking'
import './features/fallback-image'
import './features/multi-submit'
import './features/cookie-banner'

$('[data-ol-lang-selector-tooltip]').tooltip({ trigger: 'hover' })
$('[data-toggle="tooltip"]').tooltip()
