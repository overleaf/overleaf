const { callbackify } = require('util')
const Settings = require('settings-sharelatex')
const EmailBuilder = require('./EmailBuilder')
const EmailSender = require('./EmailSender')

const EMAIL_SETTINGS = Settings.email || {}

module.exports = {
  sendEmail: callbackify(sendEmail),
  promises: {
    sendEmail
  }
}

async function sendEmail(emailType, opts) {
  const email = EmailBuilder.buildEmail(emailType, opts)
  if (email.type === 'lifecycle' && !EMAIL_SETTINGS.lifecycle) {
    return
  }
  opts.html = email.html
  opts.text = email.text
  opts.subject = email.subject
  await EmailSender.promises.sendEmail(opts)
}
