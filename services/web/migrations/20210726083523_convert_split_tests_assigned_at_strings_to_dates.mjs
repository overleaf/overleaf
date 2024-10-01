import updateStringDates from '../scripts/confirmed_at_to_dates.js'

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
