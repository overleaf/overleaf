import { expect } from 'chai'
import { setTimeout } from 'node:timers/promises'
import UserHelper from './helpers/User.mjs'
import redis from './helpers/redis.mjs'
import UserSessionsRedis from '../../../app/src/Features/User/UserSessionsRedis.mjs'

const rclient = UserSessionsRedis.client()

const UserPromises = UserHelper.promises

describe('Sessions', function () {
  beforeEach(async function () {
    this.timeout(20000)
    this.user1 = new UserPromises()
    this.site_admin = new UserPromises({ email: 'admin@example.com' })
    await this.user1.login()
    await this.user1.logout()
  })

  describe('one session', function () {
    it('should have one session in UserSessions set', async function () {
      await redis.clearUserSessions(this.user1)

      // login, should add session to set
      await this.user1.login()

      const sessions = await redis.getUserSessions(this.user1)
      expect(sessions.length).to.equal(1)
      expect(sessions[0].slice(0, 5)).to.equal('sess:')

      // should be able to access project list page
      const statusCode = await this.user1.getProjectListPage()
      expect(statusCode).to.equal(200)

      // logout, should remove session from set
      await this.user1.logout()
      const sessionsAfterLogout = await redis.getUserSessions(this.user1)
      expect(sessionsAfterLogout.length).to.equal(0)
    })

    it('should update audit log on logout', async function () {
      await redis.clearUserSessions(this.user1)

      // login
      await this.user1.login()

      // logout, should add logout audit log entry (happens in background)
      await this.user1.logout()

      // poll for audit log entry since it's written in the background
      const findAuditLogEntry = async () => {
        for (let attempts = 0; attempts < 10; attempts++) {
          const auditLog = await this.user1.getAuditLogWithoutNoise()

          const logoutEntries = auditLog.filter(
            entry => entry.operation === 'logout'
          )

          // If we found the logout entry, we're done
          if (logoutEntries.length > 0) {
            return logoutEntries
          }

          await setTimeout(25)
        }

        throw new Error('Logout audit log entry not found after 10 attempts')
      }

      const logoutEntries = await findAuditLogEntry()
      expect(logoutEntries.length).to.be.greaterThan(0)
      const lastLogout = logoutEntries[logoutEntries.length - 1]
      expect(lastLogout.operation).to.equal('logout')
      expect(lastLogout.ipAddress).to.exist
      expect(lastLogout.initiatorId).to.exist
      expect(lastLogout.timestamp).to.exist
    })
  })

  describe('two sessions', function () {
    beforeEach(function () {
      // set up second session for this user
      this.user2 = new UserPromises()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
    })

    it('should have two sessions in UserSessions set', async function () {
      await redis.clearUserSessions(this.user1)

      // login, should add session to set
      await this.user1.login()

      const sessions1 = await redis.getUserSessions(this.user1)
      expect(sessions1.length).to.equal(1)
      expect(sessions1[0].slice(0, 5)).to.equal('sess:')

      // login again, should add the second session to set
      await this.user2.login()

      const sessions2 = await redis.getUserSessions(this.user1)
      expect(sessions2.length).to.equal(2)
      expect(sessions2[0].slice(0, 5)).to.equal('sess:')
      expect(sessions2[1].slice(0, 5)).to.equal('sess:')

      // both should be able to access project list page
      const statusCode1 = await this.user1.getProjectListPage()
      expect(statusCode1).to.equal(200)
      const statusCode2 = await this.user2.getProjectListPage()
      expect(statusCode2).to.equal(200)

      // logout first session, should remove session from set
      await this.user1.logout()

      const sessions3 = await redis.getUserSessions(this.user1)
      expect(sessions3.length).to.equal(1)

      // first session should not have access to project list page
      const statusCode3 = await this.user1.getProjectListPage()
      expect(statusCode3).to.equal(302)

      // second session should still have access to settings
      const statusCode4 = await this.user2.getProjectListPage()
      expect(statusCode4).to.equal(200)

      // logout second session, should remove last session from set
      await this.user2.logout()

      const sessions4 = await redis.getUserSessions(this.user1)
      expect(sessions4.length).to.equal(0)

      // second session should not have access to project list page
      const statusCode5 = await this.user2.getProjectListPage()
      expect(statusCode5).to.equal(302)
    })
  })

  describe('three sessions, password reset', function () {
    beforeEach(function () {
      // set up second session for this user
      this.user2 = new UserPromises()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
      this.user3 = new UserPromises()
      this.user3.email = this.user1.email
      this.user3.emails = this.user1.emails
      this.user3.password = this.user1.password
    })

    it('should erase both sessions when password is reset', async function () {
      await redis.clearUserSessions(this.user1)

      // login, should add session to set
      await this.user1.login()

      const sessions1 = await redis.getUserSessions(this.user1)
      expect(sessions1.length).to.equal(1)
      expect(sessions1[0].slice(0, 5)).to.equal('sess:')

      // login again, should add the second session to set
      await this.user2.login()

      const sessions2 = await redis.getUserSessions(this.user1)
      expect(sessions2.length).to.equal(2)
      expect(sessions2[0].slice(0, 5)).to.equal('sess:')
      expect(sessions2[1].slice(0, 5)).to.equal('sess:')

      // login third session, should add the second session to set
      await this.user3.login()

      const sessions3 = await redis.getUserSessions(this.user1)
      expect(sessions3.length).to.equal(3)
      expect(sessions3[0].slice(0, 5)).to.equal('sess:')
      expect(sessions3[1].slice(0, 5)).to.equal('sess:')

      // password reset from second session, should erase two of the three sessions
      await this.user2.changePassword(`password${Date.now()}`)

      const sessions4 = await redis.getUserSessions(this.user2)
      expect(sessions4.length).to.equal(1)

      // users one and three should not be able to access project list page
      const statusCode1 = await this.user1.getProjectListPage()
      expect(statusCode1).to.equal(302)
      const statusCode3 = await this.user3.getProjectListPage()
      expect(statusCode3).to.equal(302)

      // user two should still be logged in, and able to access project list page
      const statusCode2 = await this.user2.getProjectListPage()
      expect(statusCode2).to.equal(200)

      // logout second session, should remove last session from set
      await this.user2.logout()

      const sessions5 = await redis.getUserSessions(this.user1)
      expect(sessions5.length).to.equal(0)
    })
  })

  describe('three sessions, sessions page', function () {
    beforeEach(async function () {
      // set up second session for this user
      this.user2 = new UserPromises()
      this.user2.email = this.user1.email
      this.user2.emails = this.user1.emails
      this.user2.password = this.user1.password
      this.user3 = new UserPromises()
      this.user3.email = this.user1.email
      this.user3.emails = this.user1.emails
      this.user3.password = this.user1.password
      await this.user2.login()
    })

    it('should allow the user to erase the other two sessions', async function () {
      await redis.clearUserSessions(this.user1)

      // login, should add session to set
      await this.user1.login()

      const sessions1 = await redis.getUserSessions(this.user1)
      expect(sessions1.length).to.equal(1)
      expect(sessions1[0].slice(0, 5)).to.equal('sess:')

      // login again, should add the second session to set
      await this.user2.login()

      const sessions2 = await redis.getUserSessions(this.user1)
      expect(sessions2.length).to.equal(2)
      expect(sessions2[0].slice(0, 5)).to.equal('sess:')
      expect(sessions2[1].slice(0, 5)).to.equal('sess:')

      // login third session, should add the second session to set
      await this.user3.login()

      const sessions3 = await redis.getUserSessions(this.user1)
      expect(sessions3.length).to.equal(3)
      expect(sessions3[0].slice(0, 5)).to.equal('sess:')
      expect(sessions3[1].slice(0, 5)).to.equal('sess:')

      // check the sessions page
      const { response: sessionsPageResponse } = await this.user2.doRequest(
        'GET',
        '/user/sessions'
      )
      expect(sessionsPageResponse.statusCode).to.equal(200)

      // clear sessions from second session, should erase two of the three sessions
      await this.user2.getCsrfToken()
      await this.user2.doRequest('POST', '/user/sessions/clear')
      const sessions4 = await redis.getUserSessions(this.user2)
      expect(sessions4.length).to.equal(1)

      // users one and three should not be able to access project list page
      const statusCode1 = await this.user1.getProjectListPage()
      expect(statusCode1).to.equal(302)
      const statusCode3 = await this.user3.getProjectListPage()
      expect(statusCode3).to.equal(302)

      // user two should still be logged in, and able to access project list page
      const statusCode2 = await this.user2.getProjectListPage()
      expect(statusCode2).to.equal(200)

      // logout second session, should remove last session from set
      await this.user2.logout()
      const sessions5 = await redis.getUserSessions(this.user1)
      expect(sessions5.length).to.equal(0)

      // the user audit log should have been updated
      const auditLog = await this.user1.getAuditLogWithoutNoise()
      expect(auditLog).to.exist

      // find the clear-sessions entry
      const clearSessionsEntries = auditLog.filter(
        entry => entry.operation === 'clear-sessions'
      )
      expect(clearSessionsEntries.length).to.equal(1)
      expect(clearSessionsEntries[0].operation).to.equal('clear-sessions')
      expect(clearSessionsEntries[0].ipAddress).to.exist
      expect(clearSessionsEntries[0].initiatorId).to.exist
      expect(clearSessionsEntries[0].timestamp).to.exist
      expect(clearSessionsEntries[0].info.sessions.length).to.equal(2)
    })
  })

  describe('validationToken', function () {
    const User = UserHelper.promises

    async function tryWithValidationToken(validationToken) {
      const user = new User()
      await user.login()

      await checkSessionIsValid(user)

      const [, sid] = user.sessionCookie().value.match(/^s:(.+?)\./)
      const key = `sess:${sid}`
      const sess = JSON.parse(await rclient.get(key))

      expect(sess.validationToken).to.equal('v1:' + sid.slice(-4))

      sess.validationToken = validationToken
      await rclient.set(key, JSON.stringify(sess))

      {
        // The current code destroys the session and throws an error/500.
        // Check for login redirect on page reload.
        await user.doRequest('GET', '/project')

        const { response } = await user.doRequest('GET', '/project')
        expect(response.statusCode).to.equal(302)
        expect(response.headers.location).to.equal('/login?')
      }
    }

    async function getOtherUsersValidationToken() {
      const otherUser = new User()
      await otherUser.login()
      await checkSessionIsValid(otherUser)
      const { validationToken } = await otherUser.getSession()
      expect(validationToken).to.match(/^v1:.{4}$/)
      return validationToken
    }
    async function checkSessionIsValid(user) {
      const { response } = await user.doRequest('GET', '/project')
      expect(response.statusCode).to.equal(200)
    }

    it('should reject the redis value when missing', async function () {
      await tryWithValidationToken(undefined)
    })
    it('should reject the redis value when empty', async function () {
      await tryWithValidationToken('')
    })
    it('should reject the redis value when out of sync', async function () {
      await tryWithValidationToken(await getOtherUsersValidationToken())
    })
    it('should ignore overwrites in app code', async function () {
      const otherUsersValidationToken = await getOtherUsersValidationToken()

      const user = new User()
      await user.login()
      await checkSessionIsValid(user)

      const { validationToken: token1 } = await user.getSession()
      const allowedUpdateValue = 'allowed-update-value'
      await user.setInSession({
        validationToken: otherUsersValidationToken,
        // also update another field to check that the write operation went through
        allowedUpdate: allowedUpdateValue,
      })
      const { validationToken: token2, allowedUpdate } = await user.getSession()
      expect(allowedUpdate).to.equal(allowedUpdateValue)
      expect(token1).to.equal(token2)

      await checkSessionIsValid(user)
    })
  })
})
