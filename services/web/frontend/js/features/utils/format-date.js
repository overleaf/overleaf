import moment from 'moment'

moment.updateLocale('en', {
  calendar: {
    lastDay: '[Yesterday]',
    sameDay: '[Today]',
    nextDay: '[Tomorrow]',
    lastWeek: 'ddd, Do MMM YY',
    nextWeek: 'ddd, Do MMM YY',
    sameElse: 'ddd, Do MMM YY',
  },
})

export function formatTime(date, format = 'h:mm a') {
  return moment(date).format(format)
}

export function relativeDate(date) {
  return moment(date).calendar()
}

/**
 * @param {string} isoTimestamp
 * @returns {number}
 */
export function isoToUnix(isoTimestamp) {
  const unixTimestamp = Date.parse(isoTimestamp) / 1000
  return unixTimestamp
}
