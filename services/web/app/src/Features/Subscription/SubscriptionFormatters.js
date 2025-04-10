const dateformat = require('dateformat')

function formatDateTime(date) {
  if (!date) {
    return null
  }
  return dateformat(date, 'mmmm dS, yyyy h:MM TT Z', true)
}

function formatDate(date) {
  if (!date) {
    return null
  }
  return dateformat(date, 'mmmm dS, yyyy', true)
}

module.exports = {
  formatDateTime,
  formatDate,
}
