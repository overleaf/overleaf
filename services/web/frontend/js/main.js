/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import './main/token-access'
import './main/project-list/index'
import './main/clear-sessions'
import './main/account-upgrade-angular'
import './main/plans'
import './main/scribtex-popup'
import './main/event'
import './main/bonus'
import './main/system-messages'
import './main/translations'
import './main/annual-upgrade'
import './main/subscription/team-invite-controller'
import './main/learn'
import './main/keys'
import './main/importing'
import './directives/autoSubmitForm'
import './directives/asyncForm'
import './directives/complexPassword'
import './directives/stopPropagation'
import './directives/focus'
import './directives/equals'
import './directives/eventTracking'
import './directives/onEnter'
import './directives/selectAll'
import './directives/maxHeight'
import './directives/bookmarkableTabset'
import './services/queued-http'
import './services/validateCaptcha'
import './services/validateCaptchaV3'
import './filters/formatDate'
import './features/cookie-banner'
import '../../modules/modules-main.js'
import './cdn-load-test'
import { debugConsole } from '@/utils/debugging'
angular.module('SharelatexApp').config(function ($locationProvider) {
  try {
    return $locationProvider.html5Mode({
      enabled: true,
      requireBase: false,
      rewriteLinks: false,
    })
  } catch (e) {
    debugConsole.error("Error while trying to fix '#' links: ", e)
  }
})
export default angular.bootstrap(document.body, ['SharelatexApp'])
