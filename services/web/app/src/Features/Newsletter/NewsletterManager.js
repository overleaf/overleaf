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

  async function unsubscribe(user, options = {}) {
    try {
      const path = getSubscriberPath(user.email)
      if (options.delete) {
        await mailchimp.delete(path)
      } else {
        await mailchimp.patch(path, {
          status: 'unsubscribed',
          merge_fields: getMergeFields(user)
        })
      }
      logger.info(
        { user, options },
        'finished unsubscribing user from newsletter'
      )
    } catch (err) {
      if (err.status === 404 || err.status === 405) {
        // silently ignore users who were never subscribed (404) or previously deleted (405)
        return
      }

      if (err.message.includes('looks fake or invalid')) {
        logger.info(
          { err, user, options },
          'Mailchimp declined to unsubscribe user because it finds the email looks fake'
        )
        return
      }

      throw new OError({
        message: 'error unsubscribing user from newsletter',
        info: { userId: user._id }
      }).withCause(err)
    }
  }

  async function changeEmail(user, newEmail) {
    const oldEmail = user.email

    try {
      await updateEmailInMailchimp(user, newEmail)
    } catch (updateError) {
      // if we failed to update the user, delete their old email address so that
      // we don't leave it stuck in mailchimp
      logger.info(
        { oldEmail, newEmail, updateError },
        'unable to change email in newsletter, removing old mail'
      )

      try {
        await unsubscribe(user, { delete: true })
      } catch (unsubscribeError) {
        // something went wrong removing the user's address
        throw new OError({
          message:
            'error unsubscribing old email in response to email change failure',
          info: { oldEmail, newEmail, updateError }
        }).withCause(unsubscribeError)
      }

      // throw the error, unless it was an expected one that we can ignore
      if (!updateError.info || !updateError.info.nonFatal) {
        throw updateError
      }
    }
  }

  async function updateEmailInMailchimp(user, newEmail) {
    const oldEmail = user.email

    // mailchimp doesn't give us error codes, so we have to parse the message :'(
    const errors = {
      'merge fields were invalid': 'user has never subscribed',
      'could not be validated':
        'user has previously unsubscribed or new email already exist on list',
      'is already a list member': 'new email is already on mailing list',
      'looks fake or invalid': 'mail looks fake to mailchimp'
    }

    try {
      const path = getSubscriberPath(oldEmail)
      await mailchimp.patch(path, {
        email_address: newEmail,
        merge_fields: getMergeFields(user)
      })
      logger.info('finished changing email in the newsletter')
    } catch (err) {
      // silently ignore users who were never subscribed
      if (err.status === 404) {
        return
      }

      // look through expected mailchimp errors and log if we find one
      Object.keys(errors).forEach(key => {
        if (err.message.includes(key)) {
          const message = `unable to change email in newsletter, ${errors[key]}`

          logger.info({ oldEmail, newEmail }, message)

          // throw a non-fatal error
          throw new OError({
            message: message,
            info: { oldEmail, newEmail, nonFatal: true }
          }).withCause(err)
        }
      })

      // if we didn't find an expected error, generate something to throw
      throw new OError({
        message: 'error changing email in newsletter',
        info: { oldEmail, newEmail }
      }).withCause(err)
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
