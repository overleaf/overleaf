/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-undef,
    standard/no-callback-literal,
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
let defaultFromAddress, nm_client
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const nodemailer = require('nodemailer')
const sesTransport = require('nodemailer-ses-transport')
const sgTransport = require('nodemailer-sendgrid-transport')
const mandrillTransport = require('nodemailer-mandrill-transport')
const rateLimiter = require('../../infrastructure/RateLimiter')
const _ = require('underscore')

if (Settings.email != null && Settings.email.fromAddress != null) {
  defaultFromAddress = Settings.email.fromAddress
} else {
  defaultFromAddress = ''
}

// provide dummy mailer unless we have a better one configured.
let client = {
  sendMail(options, callback) {
    if (callback == null) {
      callback = function(err, status) {}
    }
    logger.log({ options }, 'Would send email if enabled.')
    return callback()
  }
}
if (
  __guard__(
    __guard__(
      Settings != null ? Settings.email : undefined,
      x1 => x1.parameters
    ),
    x => x.AWSAccessKeyID
  ) != null ||
  __guard__(Settings != null ? Settings.email : undefined, x2 => x2.driver) ===
    'ses'
) {
  logger.log('using aws ses for email')
  nm_client = nodemailer.createTransport(
    sesTransport(Settings.email.parameters)
  )
} else if (
  __guard__(
    __guard__(
      Settings != null ? Settings.email : undefined,
      x4 => x4.parameters
    ),
    x3 => x3.sendgridApiKey
  ) != null
) {
  logger.log('using sendgrid for email')
  nm_client = nodemailer.createTransport(
    sgTransport({
      auth: {
        api_key: __guard__(
          __guard__(
            Settings != null ? Settings.email : undefined,
            x6 => x6.parameters
          ),
          x5 => x5.sendgridApiKey
        )
      }
    })
  )
} else if (
  __guard__(
    __guard__(
      Settings != null ? Settings.email : undefined,
      x8 => x8.parameters
    ),
    x7 => x7.MandrillApiKey
  ) != null
) {
  logger.log('using mandril for email')
  nm_client = nodemailer.createTransport(
    mandrillTransport({
      auth: {
        apiKey: __guard__(
          __guard__(
            Settings != null ? Settings.email : undefined,
            x10 => x10.parameters
          ),
          x9 => x9.MandrillApiKey
        )
      }
    })
  )
} else if (
  __guard__(
    Settings != null ? Settings.email : undefined,
    x11 => x11.parameters
  ) != null
) {
  logger.log('using smtp for email')
  const smtp = _.pick(
    __guard__(
      Settings != null ? Settings.email : undefined,
      x12 => x12.parameters
    ),
    'host',
    'port',
    'secure',
    'auth',
    'ignoreTLS'
  )
  nm_client = nodemailer.createTransport(smtp)
} else {
  logger.warn(
    'Email transport and/or parameters not defined. No emails will be sent.'
  )
  nm_client = client
}

if (nm_client != null) {
  client = nm_client
} else {
  logger.warn(
    'Failed to create email transport. Please check your settings. No email will be sent.'
  )
}

const checkCanSendEmail = function(options, callback) {
  if (options.sendingUser_id == null) {
    // email not sent from user, not rate limited
    return callback(null, true)
  }
  const opts = {
    endpointName: 'send_email',
    timeInterval: 60 * 60 * 3,
    subjectName: options.sendingUser_id,
    throttle: 100
  }
  return rateLimiter.addCount(opts, callback)
}

module.exports = {
  sendEmail(options, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    logger.log(
      { receiver: options.to, subject: options.subject },
      'sending email'
    )
    return checkCanSendEmail(options, function(err, canContinue) {
      if (err != null) {
        return callback(err)
      }
      if (!canContinue) {
        logger.log(
          {
            sendingUser_id: options.sendingUser_id,
            to: options.to,
            subject: options.subject,
            canContinue
          },
          'rate limit hit for sending email, not sending'
        )
        return callback(new Error('rate limit hit sending email'))
      }
      metrics.inc('email')
      options = {
        to: options.to,
        from: defaultFromAddress,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo || Settings.email.replyToAddress,
        socketTimeout: 30 * 1000
      }
      if (Settings.email.textEncoding != null) {
        opts.textEncoding = textEncoding
      }
      return client.sendMail(options, function(err, res) {
        if (err != null) {
          logger.warn({ err }, 'error sending message')
          err = new Error('Cannot send email')
        } else {
          logger.log(`Message sent to ${options.to}`)
        }
        return callback(err)
      })
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
