/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let mailchimp
const async = require('async')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const crypto = require('crypto')
const Mailchimp = require('mailchimp-api-v3')

if (
  (Settings.mailchimp != null ? Settings.mailchimp.api_key : undefined) == null
) {
  logger.info('Using newsletter provider: none')
  mailchimp = {
    request(opts, cb) {
      return cb()
    }
  }
} else {
  logger.info('Using newsletter provider: mailchimp')
  mailchimp = new Mailchimp(
    Settings.mailchimp != null ? Settings.mailchimp.api_key : undefined
  )
}

module.exports = {
  subscribe(user, callback) {
    if (callback == null) {
      callback = function() {}
    }
    const options = buildOptions(user, true)
    logger.log(
      { options, user, email: user.email },
      'subscribing user to the mailing list'
    )
    return mailchimp.request(options, function(err) {
      if (err != null) {
        logger.warn({ err, user }, 'error subscribing person to newsletter')
      } else {
        logger.log({ user }, 'finished subscribing user to the newsletter')
      }
      return callback(err)
    })
  },

  unsubscribe(user, callback) {
    if (callback == null) {
      callback = function() {}
    }
    logger.log(
      { user, email: user.email },
      'trying to unsubscribe user to the mailing list'
    )
    const options = buildOptions(user, false)
    return mailchimp.request(options, function(err) {
      if (err != null) {
        logger.warn({ err, user }, 'error unsubscribing person to newsletter')
      } else {
        logger.log({ user }, 'finished unsubscribing user to the newsletter')
      }
      return callback(err)
    })
  },

  changeEmail(oldEmail, newEmail, callback) {
    if (callback == null) {
      callback = function() {}
    }
    const options = buildOptions({ email: oldEmail })
    delete options.body.status
    options.body.email_address = newEmail
    logger.log({ oldEmail, newEmail, options }, 'changing email in newsletter')
    return mailchimp.request(options, function(err) {
      if (
        err != null &&
        __guard__(err != null ? err.message : undefined, x =>
          x.indexOf('merge fields were invalid')
        ) !== -1
      ) {
        logger.log(
          { oldEmail, newEmail },
          'unable to change email in newsletter, user has never subscribed'
        )
        return callback()
      } else if (
        err != null &&
        __guard__(err != null ? err.message : undefined, x1 =>
          x1.indexOf('could not be validated')
        ) !== -1
      ) {
        logger.log(
          { oldEmail, newEmail },
          'unable to change email in newsletter, user has previously unsubscribed or new email already exist on list'
        )
        return callback()
      } else if (
        err != null &&
        err.message.indexOf('is already a list member') !== -1
      ) {
        logger.log(
          { oldEmail, newEmail },
          'unable to change email in newsletter, new email is already on mailing list'
        )
        return callback()
      } else if (
        err != null &&
        __guard__(err != null ? err.message : undefined, x2 =>
          x2.indexOf('looks fake or invalid')
        ) !== -1
      ) {
        logger.log(
          { oldEmail, newEmail },
          'unable to change email in newsletter, email looks fake to mailchimp'
        )
        return callback()
      } else if (err != null) {
        logger.warn(
          { err, oldEmail, newEmail },
          'error changing email in newsletter'
        )
        return callback(err)
      } else {
        logger.log('finished changing email in the newsletter')
        return callback()
      }
    })
  }
}

const hashEmail = email =>
  crypto
    .createHash('md5')
    .update(email.toLowerCase())
    .digest('hex')

var buildOptions = function(user, is_subscribed) {
  const subscriber_hash = hashEmail(user.email)
  const status = is_subscribed ? 'subscribed' : 'unsubscribed'
  const opts = {
    method: 'PUT',
    path: `/lists/${
      Settings.mailchimp != null ? Settings.mailchimp.list_id : undefined
    }/members/${subscriber_hash}`,
    body: {
      email_address: user.email,
      status_if_new: status
    }
  }

  // only set status if we explictly want to set it
  if (is_subscribed != null) {
    opts.body.status = status
  }

  if (user._id != null) {
    opts.body.merge_fields = {
      FNAME: user.first_name,
      LNAME: user.last_name,
      MONGO_ID: user._id
    }
  }

  return opts
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
