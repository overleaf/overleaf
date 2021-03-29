const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const User = require('./helpers/User').promises

describe('Authentication', function() {
  let user
  beforeEach('init vars', function() {
    user = new User()
  })

  describe('login', function() {
    beforeEach('doLogin', async function() {
      await user.login()
    })

    it('should log the user in', async function() {
      const {
        response: { statusCode }
      } = await user.doRequest('GET', '/project')
      expect(statusCode).to.equal(200)
    })

    it('should emit an user auditLog entry for the login', async function() {
      const {
        auditLog: [auditLogEntry]
      } = await user.get()
      expect(auditLogEntry).to.exist
      expect(auditLogEntry.timestamp).to.exist
      delete auditLogEntry.timestamp
      expect(auditLogEntry).to.deep.equal({
        operation: 'login',
        ipAddress: '127.0.0.1',
        initiatorId: ObjectId(user.id)
      })
    })
  })
})
