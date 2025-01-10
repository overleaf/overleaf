import { expect } from 'chai'
import Settings from '@overleaf/settings'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

describe('HealthCheckController', function () {
  describe('SmokeTests', function () {
    let user, projectId
    const captchaDisabledBefore = Settings.recaptcha.disabled.login

    beforeEach(async function () {
      user = new User()
      await user.login()
      projectId = await user.createProject('SmokeTest')

      // HACK: Inject the details into the app
      Settings.smokeTest.userId = user.id
      Settings.smokeTest.user = user.email
      Settings.smokeTest.password = user.password
      Settings.smokeTest.projectId = projectId

      Settings.recaptcha.disabled.login = true
    })
    afterEach(function () {
      Settings.recaptcha.disabled.login = captchaDisabledBefore
    })

    async function performSmokeTestRequest() {
      const start = Date.now()
      const { response, body } = await user.doRequest('GET', {
        url: '/health_check/full',
        json: true,
      })
      const end = Date.now()

      expect(body).to.exist
      expect(body.stats).to.exist
      expect(Date.parse(body.stats.start)).to.be.within(start, start + 1000)
      expect(Date.parse(body.stats.end)).to.be.within(end - 1000, end)

      expect(body.stats.duration).to.be.within(0, 10000)
      expect(body.stats.steps).to.be.instanceof(Array)
      return { response, body }
    }

    describe('happy path', function () {
      it('should respond with a 200 and stats', async function () {
        const { response, body } = await performSmokeTestRequest()

        expect(body.error).to.not.exist
        expect(response.statusCode).to.equal(200)
      })
    })

    describe('when the request is aborted', function () {
      it('should not crash', async function () {
        try {
          await user.doRequest('GET', {
            timeout: 1,
            url: '/health_check/full',
            json: true,
          })
        } catch (err) {
          expect(err.code).to.be.oneOf(['ETIMEDOUT', 'ESOCKETTIMEDOUT'])
          return
        }
        expect.fail('expected request to fail with timeout error')
      })
    })

    describe('when the project does not exist', function () {
      beforeEach(function () {
        Settings.smokeTest.projectId = '404'
      })
      it('should respond with a 500 ', async function () {
        const { response, body } = await performSmokeTestRequest()

        expect(body.error).to.equal('run.101_loadEditor failed')
        expect(response.statusCode).to.equal(500)
      })
    })

    describe('when the password mismatches', function () {
      beforeEach(function () {
        Settings.smokeTest.password = 'foo-bar'
      })
      it('should respond with a 500 with mismatching password', async function () {
        const { response, body } = await performSmokeTestRequest()

        expect(body.error).to.equal('run.002_login failed')
        expect(response.statusCode).to.equal(500)
      })
    })
  })
})
