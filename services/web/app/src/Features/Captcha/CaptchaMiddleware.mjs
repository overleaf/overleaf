import { fetchJson } from '@overleaf/fetch-utils'
import logger from '@overleaf/logger'
import Settings from '@overleaf/settings'
import Metrics from '@overleaf/metrics'
import OError from '@overleaf/o-error'
import DeviceHistory from './DeviceHistory.mjs'
import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import { expressify } from '@overleaf/promise-utils'
import EmailsHelper from '../Helpers/EmailHelper.mjs'
import {
  z,
  parseReq,
  getRawReqInput,
} from '../../infrastructure/Validation.mjs'

// Non-strict: this middleware only reads the two fields it needs off bodies
// whose full shape is owned by each route's own controller (login,
// passwordReset, addEmail, register) -- rejecting/stripping other fields
// here isn't this middleware's job.
const captchaBodySchema = z.object({
  body: z.object({
    email: z.string().optional(),
    // Google reCAPTCHA verification token: an opaque, third-party-defined
    // string (its format is a Google implementation detail, not documented
    // or guaranteed stable), so this stays a bare string rather than a
    // tighter pattern. The frontend's ReCaptcha2 component (recaptcha-2.tsx)
    // sends an explicit `null` -- not an omitted field -- whenever it never
    // mounted the widget (no sitekey configured, the action's captcha is
    // disabled, or `window.Cypress` in dev E2E runs), so this must accept
    // null, not just a missing key.
    'g-recaptcha-response': z.string().nullish(),
  }),
})

function respondInvalidCaptcha(req, res) {
  res.status(400).json({
    errorReason: 'cannot_verify_user_not_robot',
    message: {
      text: req.i18n.translate('cannot_verify_user_not_robot'),
    },
  })
}

async function initializeDeviceHistory(req) {
  req.deviceHistory = new DeviceHistory()
  try {
    await req.deviceHistory.parse(req)
  } catch (err) {
    logger.err({ err }, 'cannot parse deviceHistory')
  }
}

async function canSkipCaptcha(req, res) {
  const { body: reqBody } = parseReq(req, captchaBodySchema, {
    logOnly: true,
  })
  const trustedUser =
    reqBody.email &&
    (Settings.recaptcha.trustedUsers.includes(reqBody.email) ||
      Settings.recaptcha.trustedUsersRegex?.test(reqBody.email))
  if (trustedUser) {
    return res.json(true)
  }
  await initializeDeviceHistory(req)
  const canSkip = req.deviceHistory.has(reqBody.email)
  Metrics.inc('captcha_pre_flight', 1, {
    status: canSkip ? 'skipped' : 'missing',
  })
  res.json(canSkip)
}

function stripRecaptchaField(req) {
  const { body } = getRawReqInput(req)
  if (body && 'g-recaptcha-response' in body) {
    const { 'g-recaptcha-response': _x, ...rest } = body
    req.body = rest
  }
}

function validateCaptcha(action) {
  return expressify(async function (req, res, next) {
    const { body: reqBody } = parseReq(req, captchaBodySchema, {
      logOnly: true,
    })
    stripRecaptchaField(req)
    const email = EmailsHelper.parseEmail(reqBody.email)
    const trustedUser =
      email &&
      (Settings.recaptcha.trustedUsers.includes(email) ||
        Settings.recaptcha.trustedUsersRegex?.test(email))
    if (!Settings.recaptcha?.siteKey || Settings.recaptcha.disabled[action]) {
      if (action === 'login') {
        AuthenticationController.setAuditInfo(req, { captcha: 'disabled' })
      }
      Metrics.inc('captcha', 1, { path: action, status: 'disabled' })
      return next()
    }
    if (trustedUser) {
      if (action === 'login') {
        AuthenticationController.setAuditInfo(req, { captcha: 'trusted' })
      }
      Metrics.inc('captcha', 1, { path: action, status: 'trusted' })
      return next()
    }
    const reCaptchaResponse = reqBody['g-recaptcha-response']
    if (action === 'login') {
      await initializeDeviceHistory(req)
      const fromKnownDevice = req.deviceHistory.has(email)
      AuthenticationController.setAuditInfo(req, { fromKnownDevice })
      if (!reCaptchaResponse && fromKnownDevice) {
        // The user has previously logged in from this device, which required
        //  solving a captcha or keeping the device history alive.
        // We can skip checking the (missing) captcha response.
        AuthenticationController.setAuditInfo(req, { captcha: 'skipped' })
        Metrics.inc('captcha', 1, { path: action, status: 'skipped' })
        return next()
      }
    }
    if (!reCaptchaResponse) {
      Metrics.inc('captcha', 1, { path: action, status: 'missing' })
      return respondInvalidCaptcha(req, res)
    }

    let body
    try {
      body = await fetchJson(Settings.recaptcha.endpoint, {
        method: 'POST',
        body: new URLSearchParams([
          ['secret', Settings.recaptcha.secretKey],
          ['response', reCaptchaResponse],
        ]),
      })
    } catch (err) {
      Metrics.inc('captcha', 1, { path: action, status: 'error' })
      throw OError.tag(err, 'failed recaptcha siteverify request', {
        body: err.body,
      })
    }

    if (!body.success) {
      logger.warn(
        { statusCode: 200, body },
        'failed recaptcha siteverify request'
      )
      Metrics.inc('captcha', 1, { path: action, status: 'failed' })
      return respondInvalidCaptcha(req, res)
    }
    Metrics.inc('captcha', 1, { path: action, status: 'solved' })
    if (action === 'login') {
      AuthenticationController.setAuditInfo(req, { captcha: 'solved' })
    }
    next()
  })
}

export default {
  respondInvalidCaptcha,
  validateCaptcha,
  canSkipCaptcha: expressify(canSkipCaptcha),
}
