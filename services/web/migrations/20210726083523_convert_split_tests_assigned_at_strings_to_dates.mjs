import updateStringDates from '../scripts/split_tests_assigned_at_to_dates.mjs'

const tags = ['saas']

const migrate = async client => {
  await updateStringDates()
}

const rollback = async client => {
  /* nothing to do */
}

export default {
  tags,
  migrate,
  rollback,
}
