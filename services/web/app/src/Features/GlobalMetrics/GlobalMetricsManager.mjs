import { GlobalMetric } from '../../models/GlobalMetric.mjs'
/**
 * A Generic collection used to track metrics shared across the entirety of the application
 * examples:
 *  - a metric to measure how many signups we have for an expensive labs experiment, so we can end stop signups
 *  - a metric to measure how many users have been added to a test, so we can stop adding more once a cap is reached
 *
 */

async function getMetric(key, defaultValue = 0) {
  const metric = await GlobalMetric.findById(key)
  if (!metric) {
    return defaultValue
  }
  return metric.value
}

async function setMetric(key, value) {
  return await GlobalMetric.findOneAndUpdate(
    { _id: key },
    { $set: { value } },
    { new: true, upsert: true }
  )
}

async function incrementMetric(key, value = 1) {
  return await GlobalMetric.findOneAndUpdate(
    { _id: key },
    { $inc: { value } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  )
}

export default {
  getMetric,
  setMetric,
  incrementMetric,
}
