const updateStringDates = require('../scripts/split_tests_assigned_at_to_dates')

exports.tags = ['saas']

exports.migrate = async client => {
  await updateStringDates()
}

exports.rollback = async client => {
  /* nothing to do */
}
