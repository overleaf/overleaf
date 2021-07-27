const updateStringDates = require('../scripts/confirmed_at_to_dates.js')

exports.migrate = async client => {
  await updateStringDates()
}

exports.rollback = async client => {
  /* nothing to do */
}
