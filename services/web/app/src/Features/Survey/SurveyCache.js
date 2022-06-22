const SurveyManager = require('./SurveyManager')
const { Survey } = require('../../models/Survey')
const { CacheLoader } = require('cache-flow')

class SurveyCache extends CacheLoader {
  constructor() {
    super('survey', {
      expirationTime: 60, // 1min in seconds
    })
  }

  async load() {
    return await SurveyManager.getSurvey()
  }

  serialize(value) {
    return value?.toObject()
  }

  deserialize(value) {
    return new Survey(value)
  }
}

module.exports = new SurveyCache()
