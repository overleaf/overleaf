const { expect } = require('chai')
const Settings = require('settings-sharelatex')
const User = require('./helpers/User').promises

describe('HealthCheckController', function() {
  describe('SmokeTests', function() {
    let user, projectId

    beforeEach(async function() {
      user = new User()
      await user.login()
      projectId = await user.createProject('SmokeTest')

      // HACK: Inject the details into the app
      Settings.smokeTest.userId = user.id
      Settings.smokeTest.user = user.email
      Settings.smokeTest.password = user.password
      Settings.smokeTest.projectId = projectId
    })

    async function performSmokeTestRequest() {
      const { response, body } = await user.doRequest('GET', {
        url: '/health_check/full',
        json: true
      })
      expect(body).to.exist
      return { response, body }
    }

    describe('happy path', function() {
      it('should respond with a 200 and stats', async function() {
        const { response, body } = await performSmokeTestRequest()

        expect(body.error).to.not.exist
        expect(response.statusCode).to.equal(200)
      })
    })

    describe('when the project does not exist', function() {
      beforeEach(function() {
        Settings.smokeTest.projectId = '404'
      })
      it('should respond with a 500 ', async function() {
        const { response } = await performSmokeTestRequest()

        expect(response.statusCode).to.equal(500)
      })
    })

    describe('when the password mismatches', function() {
      beforeEach(function() {
        Settings.smokeTest.password = 'foo-bar'
      })
      it('should respond with a 500 with mismatching password', async function() {
        const { response } = await performSmokeTestRequest()

        expect(response.statusCode).to.equal(500)
      })
    })
  })
})
