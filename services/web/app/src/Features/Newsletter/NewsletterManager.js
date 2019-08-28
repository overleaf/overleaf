const { callbackify } = require('util')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const crypto = require('crypto')
const Mailchimp = require('mailchimp-api-v3')
const OError = require('@overleaf/o-error')

const provider = getProvider()

module.exports = {
  subscribe: callbackify(provider.subscribe),
  unsubscribe: callbackify(provider.unsubscribe),
  changeEmail: callbackify(provider.changeEmail),
  promises: provider
}

function getProvider() {
  if (mailchimpIsConfigured()) {
    logger.info('Using newsletter provider: mailchimp')
    return makeMailchimpProvider()
  } else {
    logger.info('Using newsletter provider: none')
    return makeNullProvider()
  }
}

function mailchimpIsConfigured() {
  return Settings.mailchimp != null && Settings.mailchimp.api_key != null
}

function makeMailchimpProvider() {
  const mailchimp = new Mailchimp(Settings.mailchimp.api_key)
  const MAILCHIMP_LIST_ID = Settings.mailchimp.list_id

  return {
    subscribe,
    unsubscribe,
    changeEmail
  }

  async function subscribe(user) {
    try {
      const path = getSubscriberPath(user.email)
      await mailchimp.put(path, {
        email_address: user.email,
        status: 'subscribed',
        status_if_new: 'subscribed',
        merge_fields: getMergeFields(user)
      })
      logger.info({ user }, 'finished subscribing user to newsletter')
    } catch (err) {
      throw new OError({
        message: 'error subscribing user to newsletter',
        info: { userId: user._id }
      }).withCause(err)
    }
  }

  async function unsubscribe(user) {
    try {
      const path = getSubscriberPath(user.email)
      await mailchimp.put(path, {
        email_address: user.email,
        status: 'unsubscribed',
        status_if_new: 'unsubscribed',
        merge_fields: getMergeFields(user)
      })
      logger.info({ user }, 'finished unsubscribing user from newsletter')
    } catch (err) {
      if (err.message.includes('looks fake or invalid')) {
        logger.info(
          { err, user },
          'Mailchimp declined to unsubscribe user because it finds the email looks fake'
        )
      } else {
        throw new OError({
          message: 'error unsubscribing user from newsletter',
          info: { userId: user._id }
        }).withCause(err)
      }
    }
  }

  async function changeEmail(oldEmail, newEmail) {
    try {
      const path = getSubscriberPath(oldEmail)
      await mailchimp.put(path, {
        email_address: newEmail,
        status_if_new: 'unsubscribed'
      })
      logger.info('finished changing email in the newsletter')
    } catch (err) {
      if (err.message.includes('merge fields were invalid')) {
        logger.info(
          { oldEmail, newEmail },
          'unable to change email in newsletter, user has never subscribed'
        )
      } else if (err.message.includes('could not be validated')) {
        logger.info(
          { oldEmail, newEmail },
          'unable to change email in newsletter, user has previously unsubscribed or new email already exist on list'
        )
      } else if (err.message.includes('is already a list member')) {
        logger.info(
          { oldEmail, newEmail },
          'unable to change email in newsletter, new email is already on mailing list'
        )
      } else if (err.message.includes('looks fake or invalid')) {
        logger.info(
          { oldEmail, newEmail },
          'unable to change email in newsletter, email looks fake to mailchimp'
        )
      } else {
        throw new OError({
          message: 'error changing email in newsletter',
          info: { oldEmail, newEmail }
        }).withCause(err)
      }
    }
  }

  function getSubscriberPath(email) {
    const emailHash = hashEmail(email)
    return `/lists/${MAILCHIMP_LIST_ID}/members/${emailHash}`
  }

  function hashEmail(email) {
    return crypto
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex')
  }

  function getMergeFields(user) {
    return {
      FNAME: user.first_name,
      LNAME: user.last_name,
      MONGO_ID: user._id.toString()
    }
  }
}

function makeNullProvider() {
  return {
    subscribe,
    unsubscribe,
    changeEmail
  }

  async function subscribe(user) {
    logger.info(
      { user },
      'Not subscribing user to newsletter because no newsletter provider is configured'
    )
  }

  async function unsubscribe(user) {
    logger.info(
      { user },
      'Not unsubscribing user from newsletter because no newsletter provider is configured'
    )
  }

  async function changeEmail(oldEmail, newEmail) {
    logger.info(
      { oldEmail, newEmail },
      'Not changing email in newsletter for user because no newsletter provider is configured'
    )
  }
}
