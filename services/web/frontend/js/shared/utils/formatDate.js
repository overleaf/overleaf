import moment from 'moment'

export function formatUtcDate(date) {
  if (date) {
    return moment(date).utc().format('D MMM YYYY, HH:mm:ss') + ' UTC'
  } else {
    return 'N/A'
  }
}
