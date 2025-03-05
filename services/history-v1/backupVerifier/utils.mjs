import { ObjectId } from 'mongodb'

/**
 * @param {Date} time
 * @return {ObjectId}
 */
export function objectIdFromDate(time) {
  return ObjectId.createFromTime(time.getTime() / 1000)
}
