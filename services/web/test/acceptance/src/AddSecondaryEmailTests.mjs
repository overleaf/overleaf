import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import logger from '@overleaf/logger'
import sinon from 'sinon'
import { db } from '../../../app/src/infrastructure/mongodb.mjs'
import Features from '../../../app/src/infrastructure/Features.mjs'

const User = UserHelper.promises

describe('Add secondary email address confirmation code email', function () {
  let spy
  let user, user2, res, confirmCode

  const extractConfirmCode = () => {
    const emailDebugLog = spy.args.find(
      ([, msg]) => msg === 'Would send email if enabled.'
    )
    const emailConfirmSubject = emailDebugLog[0].options.subject
    return emailConfirmSubject.match(/\((\d{6})\)/)[1]
  }

  beforeEach(async function () {
    if (!Features.hasFeature('saas')) {
      this.skip()
    }

    spy = sinon.spy(logger, 'info')
    user = new User()
    await user.register()
    await user.login()
    spy.resetHistory()

    res = await user.doRequest('POST', {
      json: {
        email: 'secondary@overleaf.com',
      },
      uri: `/user/emails/secondary`,
    })

    confirmCode = extractConfirmCode()
  })

  afterEach(function () {
    if (!Features.hasFeature('saas')) {
      this.skip()
    }

    spy.restore()
  })

  it('should send email with confirmation code', function () {
    expect(res.response.statusCode).to.equal(200)
    expect(confirmCode.length).to.equal(6)
  })

  it('should accept an explicit null g-recaptcha-response', async function () {
    // The frontend's ReCaptcha2 component (recaptcha-2.tsx) sends a literal
    // JSON `null` -- not an omitted field -- whenever it never mounted the
    // widget (no sitekey, action disabled, or `window.Cypress` in dev E2E
    // runs). CaptchaMiddleware's schema accepts that shape rather than
    // 400ing on "expected string, received null", then strips the field
    // from req.body before addWithConfirmationCodeSchema -- which doesn't
    // declare the field at all -- ever sees it.
    const nullCaptchaRes = await user.doRequest('POST', {
      json: {
        email: 'secondary-null-captcha@overleaf.com',
        'g-recaptcha-response': null,
      },
      uri: `/user/emails/secondary`,
    })
    expect(nullCaptchaRes.response.statusCode).to.equal(200)
  })

  it('should reject a non-string g-recaptcha-response', async function () {
    const badCaptchaRes = await user.doRequest('POST', {
      json: {
        email: 'secondary-bad-captcha@overleaf.com',
        'g-recaptcha-response': ['not', 'a', 'string'],
      },
      uri: `/user/emails/secondary`,
    })
    expect(badCaptchaRes.response.statusCode).to.equal(400)
  })

  describe('with a valid confirmation code', function () {
    beforeEach(async function () {
      this.result = await user.doRequest('POST', {
        json: {
          code: confirmCode,
        },
        uri: '/user/emails/confirm-secondary',
      })
    })

    it('should redirect to /project', async function () {
      expect(this.result.response.statusCode).to.equal(200)
      expect(this.result.body.redir).to.equal('/project')
    })

    it('the new email should be saved in mongo', async function () {
      const userInDb = await db.users.findOne(
        { email: user.email },
        { projection: { emails: 1 } }
      )
      expect(userInDb).to.exist
      const newSecondaryEmail = userInDb.emails.find(
        email => email.email === 'secondary@overleaf.com'
      )
      expect(newSecondaryEmail).to.exist
      expect(newSecondaryEmail.confirmedAt).to.exist
      expect(newSecondaryEmail.reconfirmedAt).to.exist
      expect(newSecondaryEmail.reconfirmedAt).to.deep.equal(
        newSecondaryEmail.confirmedAt
      )
    })
  })

  describe('with an invalid confirmation code', function () {
    beforeEach(async function () {
      this.result = await user.doRequest('POST', {
        json: {
          code: '123',
        },
        uri: '/user/emails/confirm-secondary',
      })
    })

    it('should respond with invalid confirmation code error', async function () {
      expect(this.result.response.statusCode).to.equal(403)
      expect(this.result.body.message.key).to.equal('invalid_confirmation_code')
    })
  })

  it('should reject a non-string confirmation code', async function () {
    const badCodeRes = await user.doRequest('POST', {
      json: {
        code: ['not', 'a', 'string'],
      },
      uri: '/user/emails/confirm-secondary',
    })
    expect(badCodeRes.response.statusCode).to.equal(400)
  })

  describe('with a duplicate email', async function () {
    beforeEach(async function () {
      await user.doRequest('POST', {
        json: {
          code: confirmCode,
        },
        uri: '/user/emails/confirm-secondary',
      })

      user2 = new User()
      await user2.register()
      await user2.login()
    })

    it('should respond with a email already registered error', async function () {
      res = await user2.doRequest('POST', {
        json: {
          email: 'secondary@overleaf.com',
        },
        uri: `/user/emails/secondary`,
      })

      expect(res.response.statusCode).to.equal(409)
      expect(res.body.message.text).to.equal(
        'This email address is already associated with a different Overleaf account.'
      )
    })
  })

  it('should hit rate limit on code check', async function () {
    let confirmEmailReq
    for (let i = 0; i < 20; i++) {
      confirmEmailReq = await user.doRequest('POST', {
        json: {
          code: '123',
        },
        uri: '/user/emails/confirm-secondary',
      })
    }

    expect(confirmEmailReq.response.statusCode).to.equal(429)
  })

  it('should resend confirm code', async function () {
    const oldConfirmCode = extractConfirmCode()
    spy.resetHistory()

    const resendCodeRes = await user.doRequest('POST', {
      uri: '/user/emails/resend-secondary-confirmation',
    })

    const newConfirmCode = extractConfirmCode()

    expect(resendCodeRes.response.statusCode).to.equal(200)
    expect(JSON.parse(resendCodeRes.body).message.key).to.equal(
      'we_sent_new_code'
    )

    const oldConfirmRes = await user.doRequest('POST', {
      json: {
        code: oldConfirmCode,
      },
      uri: '/user/emails/confirm-secondary',
    })

    expect(oldConfirmRes.response.statusCode).to.equal(403)
    expect(oldConfirmRes.body.message.key).to.equal('invalid_confirmation_code')

    const newCodeRes = await user.doRequest('POST', {
      json: {
        code: newConfirmCode,
      },
      uri: '/user/emails/confirm-secondary',
    })

    expect(newCodeRes.response.statusCode).to.equal(200)
    expect(newCodeRes.body.redir).to.equal('/project')
  })

  it('should hit rate limit on code resend', async function () {
    let resendCodeReq
    for (let i = 0; i < 5; i++) {
      resendCodeReq = await user.doRequest('POST', {
        json: true,
        uri: '/user/emails/resend-secondary-confirmation',
      })
    }

    expect(resendCodeReq.response.statusCode).to.equal(429)
  })
})
