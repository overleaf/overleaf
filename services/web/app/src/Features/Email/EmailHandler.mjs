import { callbackify } from 'node:util'
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import EmailBuilder from './EmailBuilder.mjs'
import EmailSender from './EmailSender.mjs'
import Queues from '../../infrastructure/Queues.mjs'

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

export default {
  sendEmail: callbackify(sendEmail),
  sendDeferredEmail,
  promises: {
    sendEmail,
  },
}
