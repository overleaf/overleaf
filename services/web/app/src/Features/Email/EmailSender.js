const { callbackify } = require('util')
const logger = require('@overleaf/logger')
const metrics = require('@overleaf/metrics')
const Settings = require('@overleaf/settings')
const nodemailer = require('nodemailer')
const sesTransport = require('nodemailer-ses-transport')
const mandrillTransport = require('nodemailer-mandrill-transport')
const OError = require('@overleaf/o-error')
const { RateLimiter } = require('../../infrastructure/RateLimiter')
const _ = require('lodash')

const EMAIL_SETTINGS = Settings.email || {}

module.exports = {
  sendEmail: callbackify(sendEmail),
  promises: {
    sendEmail,
  },
}

const client = getClient()

const rateLimiter = new RateLimiter('send_email', {
  points: 100,
  duration: 3 * 60 * 60,
})

function getClient() {
  let client
  if (EMAIL_SETTINGS.parameters) {
    const emailParameters = EMAIL_SETTINGS.parameters
    if (emailParameters.AWSAccessKeyID || EMAIL_SETTINGS.driver === 'ses') {
      logger.debug('using aws ses for email')
      client = nodemailer.createTransport(sesTransport(emailParameters))
    } else if (emailParameters.sendgridApiKey) {
      throw new OError(
        'sendgridApiKey configuration option is deprecated, use SMTP instead'
      )
    } else if (emailParameters.MandrillApiKey) {
      logger.debug('using mandril for email')
      client = nodemailer.createTransport(
        mandrillTransport({
          auth: {
            apiKey: emailParameters.MandrillApiKey,
          },
        })
      )
    } else {
      logger.debug('using smtp for email')
      const smtp = _.pick(
        emailParameters,
        'host',
        'port',
        'secure',
        'auth',
        'ignoreTLS',
        'logger',
        'name'
      )
      client = nodemailer.createTransport(smtp)
    }
  } else {
    logger.warn(
      'Email transport and/or parameters not defined. No emails will be sent.'
    )
    client = {
      async sendMail(options) {
        logger.debug({ options }, 'Would send email if enabled.')
      },
    }
  }
  return client
}

async function sendEmail(options) {
  try {
    const canContinue = await checkCanSendEmail(options)
    if (!canContinue) {
      logger.debug(
        {
          sendingUserId: options.sendingUser_id,
          to: options.to,
          subject: options.subject,
          canContinue,
        },
        'rate limit hit for sending email, not sending'
      )
      throw new OError('rate limit hit sending email')
    }
    metrics.inc('email')
    const sendMailOptions = {
      to: options.to,
      from: EMAIL_SETTINGS.fromAddress || '',
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || EMAIL_SETTINGS.replyToAddress,
      socketTimeout: 30 * 1000,
    }
    if (EMAIL_SETTINGS.textEncoding != null) {
      sendMailOptions.textEncoding = EMAIL_SETTINGS.textEncoding
    }
    await client.sendMail(sendMailOptions)
  } catch (err) {
    throw new OError('error sending message').withCause(err)
  }
}

async function checkCanSendEmail(options) {
  if (options.sendingUser_id == null) {
    // email not sent from user, not rate limited
    return true
  }
  try {
    await rateLimiter.consume(options.sendingUser_id)
  } catch (err) {
    if (err instanceof Error) {
      throw err
    } else {
      return false
    }
  }
  return true
}
