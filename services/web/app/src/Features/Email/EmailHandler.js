const { callbackify } = require('util')
const Settings = require('@overleaf/settings')
const EmailBuilder = require('./EmailBuilder')
const EmailSender = require('./EmailSender')
const Queues = require('../../infrastructure/Queues')

const EMAIL_SETTINGS = Settings.email || {}

module.exports = {
  sendEmail: callbackify(sendEmail),
  sendDeferredEmail,
  promises: {
    sendEmail,
  },
}

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
  )
}
