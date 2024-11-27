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

export function formatTimeBasedOnYear(date) {
  const currentDate = moment()

  return currentDate.diff(date, 'years') > 0
    ? formatTime(date, 'D MMMM YYYY, h:mm a')
    : formatTime(date, 'D MMMM, h:mm a')
}
