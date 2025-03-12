import { ObjectId } from 'mongodb'
import config from 'config'

export const RPO = parseInt(config.get('backupRPOInMS'), 10)

/**
 * @param {Date} time
 * @return {ObjectId}
 */
export function objectIdFromDate(time) {
  return ObjectId.createFromTime(time.getTime() / 1000)
}

/**
 * Creates a startDate, endDate pair that checks a period of time before the RPO horizon
 *
 * @param {number} offset - How many seconds we should check
 * @return {{endDate: Date, startDate: Date}}
 */
export function getDatesBeforeRPO(offset) {
  const now = new Date()
  const endDate = new Date(now.getTime() - RPO)
  return {
    endDate,
    startDate: new Date(endDate.getTime() - offset * 1000),
  }
}
