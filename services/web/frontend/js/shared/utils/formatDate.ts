import moment from 'moment'

export function formatLocalDate(date: moment.MomentInput) {
  if (date) {
    return moment(date).format('D MMM YYYY, HH:mm:ss Z')
  } else {
    return 'N/A'
  }
}
