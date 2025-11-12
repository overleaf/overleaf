import SurveyManager from './SurveyManager.mjs'
import { Survey } from '../../models/Survey.mjs'
import { CacheLoader } from 'cache-flow'

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

export default new SurveyCache()
