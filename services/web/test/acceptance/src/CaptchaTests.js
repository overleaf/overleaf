const { expect } = require('chai')
const User = require('./helpers/User').promises

describe('Captcha', function () {
  let user

  beforeEach('create user', async function () {
    user = new User()
    await user.ensureUserExists()
  })

  async function loginWithCaptcha(captchaResponse) {
    return loginWithEmailAndCaptcha(user.email, captchaResponse)
  }

  async function loginWithEmailAndCaptcha(email, captchaResponse) {
    await user.getCsrfToken()
    return user.doRequest('POST', {
      url: '/login',
      json: {
        email,
        password: user.password,
        'g-recaptcha-response': captchaResponse,
      },
    })
  }

  async function canSkipCaptcha(email) {
    await user.getCsrfToken()
    const { response, body } = await user.doRequest('POST', {
      url: '/login/can-skip-captcha',
      json: { email },
    })
    expect(response.statusCode).to.equal(200)
    return body
  }

  function expectBadCaptchaResponse(response, body) {
    expect(response.statusCode).to.equal(400)
    expect(body.errorReason).to.equal('cannot_verify_user_not_robot')
  }

  function expectSuccessfulLogin(response, body) {
    expect(response.statusCode).to.equal(200)
    expect(body).to.deep.equal({ redir: '/project' })
  }

  it('should reject a login without captcha response', async function () {
    const { response, body } = await loginWithCaptcha('')
    expectBadCaptchaResponse(response, body)
  })

  it('should reject a login with an invalid captcha response', async function () {
    const { response, body } = await loginWithCaptcha('invalid')
    expectBadCaptchaResponse(response, body)
  })

  it('should accept a login with a valid captcha response', async function () {
    const { response, body } = await loginWithCaptcha('valid')
    expectSuccessfulLogin(response, body)
  })

  it('should note the solved captcha in audit log', async function () {
    const { response, body } = await loginWithCaptcha('valid')
    expectSuccessfulLogin(response, body)

    expect((await user.get()).auditLog.pop().info).to.deep.equal({
      captcha: 'solved',
      method: 'Password login',
    })
  })

  describe('deviceHistory', function () {
    beforeEach('login', async function () {
      const { response, body } = await loginWithCaptcha('valid')
      expectSuccessfulLogin(response, body)
    })

    it('should be able to skip captcha with the same email', async function () {
      expect(await canSkipCaptcha(user.email)).to.equal(true)
    })

    it('should be able to omit captcha with the same email', async function () {
      const { response, body } = await loginWithCaptcha('')
      expectSuccessfulLogin(response, body)
    })

    it('should note the skipped captcha in audit log', async function () {
      const { response, body } = await loginWithCaptcha('')
      expectSuccessfulLogin(response, body)

      expect((await user.get()).auditLog.pop().info).to.deep.equal({
        captcha: 'skipped',
        method: 'Password login',
      })
    })

    it('should request a captcha for another email', async function () {
      expect(await canSkipCaptcha('a@bc.de')).to.equal(false)
    })

    it('should flag missing captcha for another email', async function () {
      const { response, body } = await loginWithEmailAndCaptcha('a@bc.de', '')
      expectBadCaptchaResponse(response, body)
    })

    describe('cycle history', function () {
      beforeEach('create and login with 10 other users', async function () {
        for (let i = 0; i < 10; i++) {
          const otherUser = new User()
          otherUser.password = user.password
          await otherUser.ensureUserExists()
          const { response, body } = await loginWithEmailAndCaptcha(
            otherUser.email,
            'valid'
          )
          expectSuccessfulLogin(response, body)
        }
      })

      it('should have rolled out the initial users email', async function () {
        const { response, body } = await loginWithCaptcha('')
        expectBadCaptchaResponse(response, body)
      })
    })
  })
})
