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

export function formatTime(date) {
  return moment(date).format('h:mm a')
}

export function relativeDate(date) {
  return moment(date).calendar()
}
