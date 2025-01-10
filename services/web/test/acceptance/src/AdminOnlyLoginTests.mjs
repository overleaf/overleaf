import Settings from '@overleaf/settings'
import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

describe('AdminOnlyLogin', function () {
  let adminUser, regularUser
  const flagBefore = Settings.adminOnlyLogin
  after(function () {
    Settings.adminOnlyLogin = flagBefore
  })

  beforeEach('create admin user', async function () {
    adminUser = new User()
    await adminUser.ensureUserExists()
    await adminUser.ensureAdmin()
  })

  beforeEach('create regular user', async function () {
    regularUser = new User()
    await regularUser.ensureUserExists()
  })

  async function expectCanLogin(user) {
    const response = await user.login()
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.deep.equal({ redir: '/project' })
  }

  async function expectRejectedLogin(user) {
    try {
      await user.login()
      expect.fail('expected the login request to fail')
    } catch (err) {
      expect(err).to.match(/login failed: status=403/)
      expect(err.info.body).to.deep.equal({
        message: { type: 'error', text: 'Admin only panel' },
      })
    }
  }

  describe('adminOnlyLogin=true', function () {
    beforeEach(function () {
      Settings.adminOnlyLogin = true
    })

    it('should allow the admin user to login', async function () {
      await expectCanLogin(adminUser)
    })

    it('should block a regular user from login', async function () {
      await expectRejectedLogin(regularUser)
    })
  })

  describe('adminOnlyLogin=false', function () {
    beforeEach(function () {
      Settings.adminOnlyLogin = false
    })

    it('should allow the admin user to login', async function () {
      await expectCanLogin(adminUser)
    })

    it('should allow a regular user to login', async function () {
      await expectCanLogin(regularUser)
    })
  })
})
