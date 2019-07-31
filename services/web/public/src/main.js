/* eslint-disable
    max-len,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define([
  'main/project-list/index',
  'main/user-details',
  'main/account-settings',
  'main/clear-sessions',
  'main/account-upgrade',
  'main/plans',
  'main/user-membership',
  'main/scribtex-popup',
  'main/event',
  'main/bonus',
  'main/system-messages',
  'main/translations',
  'main/subscription-dashboard',
  'main/new-subscription',
  'main/annual-upgrade',
  'main/announcements',
  'main/register-users',
  'main/subscription/team-invite-controller',
  'main/contact-us',
  'main/learn',
  'main/affiliations/components/affiliationForm',
  'main/affiliations/controllers/UserAffiliationsController',
  'main/affiliations/factories/UserAffiliationsDataService',
  'main/oauth/controllers/UserOauthController',
  'main/keys',
  'main/importing',
  'analytics/AbTestingManager',
  'directives/autoSubmitForm',
  'directives/asyncForm',
  'directives/complexPassword',
  'directives/stopPropagation',
  'directives/focus',
  'directives/equals',
  'directives/eventTracking',
  'directives/fineUpload',
  'directives/onEnter',
  'directives/selectAll',
  'directives/maxHeight',
  'directives/creditCards',
  'directives/bookmarkableTabset',
  'services/queued-http',
  'services/validateCaptcha',
  'services/validateCaptchaV3',
  'filters/formatDate',
  'components/inputSuggestions',
  '__MAIN_CLIENTSIDE_INCLUDES__'
], function() {
  angular.module('SharelatexApp').config(function($locationProvider) {
    try {
      return $locationProvider.html5Mode({
        enabled: true,
        requireBase: false,
        rewriteLinks: false
      })
    } catch (e) {
      return console.error("Error while trying to fix '#' links: ", e)
    }
  })
  return angular.bootstrap(document.body, ['SharelatexApp'])
})
