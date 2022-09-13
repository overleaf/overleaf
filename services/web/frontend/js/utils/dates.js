import moment from 'moment'

export function formatDate(date, format) {
  if (!date) return 'N/A'
  if (format == null) {
    format = 'Do MMM YYYY, h:mm a'
  }
  return moment(date).format(format)
}

export function fromNowDate(date) {
  return moment(date).fromNow()
}
