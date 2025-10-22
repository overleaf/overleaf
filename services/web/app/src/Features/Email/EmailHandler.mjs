const { callbackify } = require('util')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const EmailBuilder = require('./EmailBuilder')
const EmailSender = require('./EmailSender')
const Queues = require('../../infrastructure/Queues')

const EMAIL_SETTINGS = Settings.email || {}

/**
 * @param {string} emailType
 * @param {opts} any
 */
async function sendEmail(emailType, opts) {
  const email = EmailBuilder.buildEmail(emailType, opts)
  if (email.type === 'lifecycle' && !EMAIL_SETTINGS.lifecycle) {
    return
  }
  opts.html = email.html
  opts.text = email.text
  opts.subject = email.subject
  await EmailSender.promises.sendEmail(opts, emailType)
}

function sendDeferredEmail(emailType, opts, delay) {
  Queues.createScheduledJob(
    'deferred-emails',
    { data: { emailType, opts } },
    delay
  ).catch(err => {
    logger.warn({ err, emailType, opts }, 'failed to queue deferred email')
  })
}

module.exports = {
  sendEmail: callbackify(sendEmail),
  sendDeferredEmail,
  promises: {
    sendEmail,
  },
}
