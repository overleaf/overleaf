import { Survey } from '../../models/Survey.mjs'
import OError from '@overleaf/o-error'

async function getSurvey() {
  try {
    return await Survey.findOne().exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get survey')
  }
}

async function updateSurvey({ name, title, text, cta, url, options }) {
  validateOptions(options)
  let survey = await getSurvey()
  if (!survey) {
    survey = new Survey()
  }
  survey.name = name
  survey.title = title
  survey.text = text
  survey.cta = cta
  survey.url = url
  survey.options = options
  await survey.save()
  return survey
}

function validateOptions(options) {
  if (!options) {
    return
  }
  if (typeof options !== 'object') {
    throw new Error('options must be an object')
  }
  const { earliestSignupDate, latestSignupDate } = options

  const earliestDate = parseDate(earliestSignupDate)
  const latestDate = parseDate(latestSignupDate)
  if (earliestDate && latestDate) {
    if (earliestDate > latestDate) {
      throw new Error('earliestSignupDate must be before latestSignupDate')
    }
  }
}

function parseDate(date) {
  if (date) {
    if (typeof date !== 'string') {
      throw new Error('Date must be a string')
    }
    if (date.match(/^\d{4}-\d{2}-\d{2}$/) === null) {
      throw new Error('Date must be in YYYY-MM-DD format')
    }
    const asDate = new Date(date)
    if (isNaN(asDate.getTime())) {
      throw new Error('Date must be a valid date')
    }
    return asDate
  }
  return null
}

async function deleteSurvey() {
  const survey = await getSurvey()
  if (survey) {
    await survey.deleteOne()
  }
}

export default {
  getSurvey,
  updateSurvey,
  deleteSurvey,
}
