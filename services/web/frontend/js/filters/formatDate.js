/* eslint-disable
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base', 'moment'], function(App, moment) {
  moment.updateLocale('en', {
    calendar: {
      lastDay: '[Yesterday]',
      sameDay: '[Today]',
      nextDay: '[Tomorrow]',
      lastWeek: 'ddd, Do MMM YY',
      nextWeek: 'ddd, Do MMM YY',
      sameElse: 'ddd, Do MMM YY'
    }
  })

  App.filter(
    'formatDate',
    () =>
      function(date, format) {
        if (!date) return 'N/A'
        if (format == null) {
          format = 'Do MMM YYYY, h:mm a'
        }
        return moment(date).format(format)
      }
  )

  App.filter('relativeDate', () => date => moment(date).calendar())

  App.filter('fromNowDate', () => date => moment(date).fromNow())
})
