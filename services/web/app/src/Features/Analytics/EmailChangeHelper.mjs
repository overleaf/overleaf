// @ts-check
import UserGetter from '../User/UserGetter.mjs'

import AnalyticsManager from './AnalyticsManager.mjs'

const { registerEmailChange } = AnalyticsManager

/**
 * @typedef {object} EmailData
 * @property {string} email
 * @property {Date} createdAt
 * @property {Date} confirmedAt
 * @property {boolean} default
 */

/**
 * @typedef {object} EventData
 * @property {Date} [emailCreatedAt] ISO string of when the email was created
 * @property {Date} [emailConfirmedAt] ISO string of when the email was confirmed
 * @property {Date} [emailDeletedAt] ISO string of when the email was deleted
 * @property {boolean} [isPrimary] Whether the email is the primary email
 */

/**
 * @typedef {import('./types').EmailChangePayload} EmailChangePayload
 */

/**
 *
 * @param {string} userId
 * @param {string} email
 * @param {EventData} eventData
 * @returns {Promise<void>}
 */
async function registerEmailUpdate(userId, email, eventData = {}) {
  const emailChangeEvent = await makeEmailChangeEvent(userId, email, eventData)

  registerEmailChange({
    ...emailChangeEvent,
    action: 'updated',
  })
}

/**
 *
 * @param {string} userId
 * @param {string} email
 * @param {EventData} eventData
 * @returns {Promise<Omit<EmailChangePayload, 'action'>>}
 */
async function makeEmailChangeEvent(userId, email, eventData) {
  const userEmails = await UserGetter.promises.getUserFullEmails(userId)
  const emailData = userEmails.find(userEmail => userEmail.email === email)

  const filledEventData = fillMissingEventData(eventData, emailData)

  return {
    userId,
    email,
    createdAt: new Date().toISOString(),
    emailCreatedAt: filledEventData?.emailCreatedAt?.toISOString() ?? null,
    emailConfirmedAt: filledEventData?.emailConfirmedAt?.toISOString() ?? null,
    emailDeletedAt: filledEventData?.emailDeletedAt?.toISOString() ?? null,
    isPrimary: filledEventData?.isPrimary ?? false,
  }
}

/**
 *
 * @param {string} userId
 * @param {string} email
 * @param {EventData} eventData
 * @returns {Promise<void>}
 */
async function registerEmailCreation(userId, email, eventData = {}) {
  const emailChangeEvent = await makeEmailChangeEvent(userId, email, eventData)

  registerEmailChange({
    ...emailChangeEvent,
    action: 'created',
  })
}

/**
 *
 * @param {string} userId
 * @param {string} email
 * @param {EventData} eventData
 * @returns {Promise<void>}
 */
async function registerEmailDeletion(userId, email, eventData = {}) {
  const emailChangeEvent = await makeEmailChangeEvent(userId, email, eventData)

  registerEmailChange({
    ...emailChangeEvent,
    action: 'deleted',
  })
}

/**
 *
 * @param {EventData} eventData
 * @param {EmailData | null} emailData
 * @return {EventData}
 */
function fillMissingEventData(eventData, emailData) {
  if (emailData) {
    if (!eventData.emailCreatedAt) {
      eventData.emailCreatedAt = emailData.createdAt
    }
    if (!eventData.emailConfirmedAt && emailData.confirmedAt) {
      eventData.emailConfirmedAt = emailData.confirmedAt
    }
    if (eventData.isPrimary === undefined) {
      eventData.isPrimary = emailData.default
    }
  }
  return eventData
}

export default {
  registerEmailUpdate,
  registerEmailCreation,
  registerEmailDeletion,
}
