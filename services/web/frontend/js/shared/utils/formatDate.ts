import moment from 'moment'

export function formatUtcDate(date: moment.MomentInput) {
  if (date) {
    return moment(date).utc().format('D MMM YYYY, HH:mm:ss') + ' UTC'
  } else {
    return 'N/A'
  }
}
