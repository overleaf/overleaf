const { callbackify } = require('util')
const logger = require('logger-sharelatex')
const metrics = require('metrics-sharelatex')
const Settings = require('settings-sharelatex')
const nodemailer = require('nodemailer')
const sesTransport = require('nodemailer-ses-transport')
const sgTransport = require('nodemailer-sendgrid-transport')
const mandrillTransport = require('nodemailer-mandrill-transport')
const OError = require('@overleaf/o-error')
const RateLimiter = require('../../infrastructure/RateLimiter')
const _ = require('underscore')

const EMAIL_SETTINGS = Settings.email || {}

module.exports = {
  sendEmail: callbackify(sendEmail),
  promises: {
    sendEmail
  }
}

const client = getClient()

function getClient() {
  let client
  if (EMAIL_SETTINGS.parameters) {
    const emailParameters = EMAIL_SETTINGS.parameters
    if (emailParameters.AWSAccessKeyID || EMAIL_SETTINGS.driver === 'ses') {
      logger.log('using aws ses for email')
      client = nodemailer.createTransport(sesTransport(emailParameters))
    } else if (emailParameters.sendgridApiKey) {
      logger.log('using sendgrid for email')
      client = nodemailer.createTransport(
        sgTransport({
          auth: {
            api_key: emailParameters.sendgridApiKey
          }
        })
      )
    } else if (emailParameters.MandrillApiKey) {
      logger.log('using mandril for email')
      client = nodemailer.createTransport(
        mandrillTransport({
          auth: {
            apiKey: emailParameters.MandrillApiKey
          }
        })
      )
    } else {
      logger.log('using smtp for email')
      const smtp = _.pick(
        emailParameters,
        'host',
        'port',
        'secure',
        'auth',
        'ignoreTLS'
      )
      client = nodemailer.createTransport(smtp)
    }
  } else {
    logger.warn(
      'Email transport and/or parameters not defined. No emails will be sent.'
    )
    client = {
      async sendMail(options) {
        logger.log({ options }, 'Would send email if enabled.')
      }
    }
  }
  return client
}

async function sendEmail(options) {
  try {
    const canContinue = await checkCanSendEmail(options)
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
      throw new OError({ message: 'rate limit hit sending email' })
    }
    metrics.inc('email')
    let sendMailOptions = {
      to: options.to,
      from: EMAIL_SETTINGS.fromAddress || '',
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo || EMAIL_SETTINGS.replyToAddress,
      socketTimeout: 30 * 1000
    }
    if (EMAIL_SETTINGS.textEncoding != null) {
      sendMailOptions.textEncoding = EMAIL_SETTINGS.textEncoding
    }
    await client.sendMail(sendMailOptions)
  } catch (err) {
    throw new OError({
      message: 'error sending message'
    }).withCause(err)
  }
}

async function checkCanSendEmail(options) {
  if (options.sendingUser_id == null) {
    // email not sent from user, not rate limited
    return true
  }
  const opts = {
    endpointName: 'send_email',
    timeInterval: 60 * 60 * 3,
    subjectName: options.sendingUser_id,
    throttle: 100
  }
  const allowed = await RateLimiter.promises.addCount(opts)
  return allowed
}
