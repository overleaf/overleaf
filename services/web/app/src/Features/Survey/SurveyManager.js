const { Survey } = require('../../models/Survey')
const OError = require('@overleaf/o-error')

async function getSurvey() {
  try {
    return await Survey.findOne().exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get survey')
  }
}

async function updateSurvey({ name, preText, linkText, url, options }) {
  let survey = await getSurvey()
  if (!survey) {
    survey = new Survey()
  }
  survey.name = name
  survey.preText = preText
  survey.linkText = linkText
  survey.url = url
  survey.options = options
  await survey.save()
  return survey
}

async function deleteSurvey() {
  const survey = await getSurvey()
  if (survey) {
    await survey.deleteOne()
  }
}

module.exports = {
  getSurvey,
  updateSurvey,
  deleteSurvey,
}
