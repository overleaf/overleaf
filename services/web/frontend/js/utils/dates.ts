import moment from 'moment'

export function formatDate(date: moment.MomentInput, format?: string) {
  if (!date) return 'N/A'
  if (format == null) {
    format = 'Do MMM YYYY, h:mm a'
  }
  return moment(date).format(format)
}

export function fromNowDate(date: moment.MomentInput | string) {
  return moment(date).fromNow()
}
