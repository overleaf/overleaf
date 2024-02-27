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
import './main/token-access' // used in project/token/access
import './main/event' // used in various controllers
import './main/bonus' // used in referal/bonus
import './main/system-messages' // used in project/editor
import './main/annual-upgrade' // used in subscriptions/upgradeToAnnual
import './main/subscription/team-invite-controller' // used in subscriptions/team/invite
import './directives/eventTracking' // used in lots of places
import './features/cookie-banner'
import '../../modules/modules-main'
import { debugConsole } from '@/utils/debugging'
angular.module('OverleafApp').config([
  '$locationProvider',
  function ($locationProvider) {
    try {
      return $locationProvider.html5Mode({
        enabled: true,
        requireBase: false,
        rewriteLinks: false,
      })
    } catch (e) {
      debugConsole.error("Error while trying to fix '#' links: ", e)
    }
  },
])
export default angular.bootstrap(document.body, ['OverleafApp'])
