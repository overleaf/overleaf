const Settings = require('@overleaf/settings')
const { expect } = require('chai')
const User = require('./helpers/User').promises

describe('AdminPrivilegeAvailable', function () {
  let adminUser, otherUser
  const flagBefore = Settings.adminPrivilegeAvailable
  after(function () {
    Settings.adminPrivilegeAvailable = flagBefore
  })

  beforeEach('create admin user', async function () {
    adminUser = new User()
    await adminUser.ensureUserExists()
    await adminUser.ensureAdmin()
    await adminUser.login()
  })

  let projectIdOwned, otherUsersProjectId, otherUsersProjectTokenAccessURL
  beforeEach('create owned project', async function () {
    projectIdOwned = await adminUser.createProject('owned project')
  })

  beforeEach('create other user and project', async function () {
    otherUser = new User()
    await otherUser.login()

    otherUsersProjectId = await otherUser.createProject('other users project')
    await otherUser.makeTokenBased(otherUsersProjectId)
    const {
      tokens: { readOnly: readOnlyToken },
    } = await otherUser.getProject(otherUsersProjectId)
    otherUsersProjectTokenAccessURL = `/read/${readOnlyToken}`
  })

  async function hasAccess(projectId) {
    const { response } = await adminUser.doRequest(
      'GET',
      `/project/${projectId}`
    )
    return response.statusCode === 200
  }

  async function displayTokenAccessPage(user) {
    const { response } = await user.doRequest(
      'GET',
      otherUsersProjectTokenAccessURL
    )
    expect(response.statusCode).to.equal(200)
    expect(response.body).to.include(otherUsersProjectTokenAccessURL)
  }

  describe('adminPrivilegeAvailable=true', function () {
    beforeEach(function () {
      Settings.adminPrivilegeAvailable = true
    })
    it('should grant the admin access to owned project', async function () {
      expect(await hasAccess(projectIdOwned)).to.equal(true)
    })
    it('should grant the admin access to non-owned project', async function () {
      expect(await hasAccess(otherUsersProjectId)).to.equal(true)
    })
    it('should display token access page for admin', async function () {
      await displayTokenAccessPage(adminUser)
    })
    it('should display token access page for regular user', async function () {
      await displayTokenAccessPage(otherUser)
    })
  })

  describe('adminPrivilegeAvailable=false', function () {
    beforeEach(function () {
      Settings.adminPrivilegeAvailable = false
    })
    it('should grant the admin access to owned project', async function () {
      expect(await hasAccess(projectIdOwned)).to.equal(true)
    })
    it('should block the admin from non-owned project', async function () {
      expect(await hasAccess(otherUsersProjectId)).to.equal(false)
    })
    it('should redirect a token access request to admin panel', async function () {
      const { response } = await adminUser.doRequest(
        'GET',
        otherUsersProjectTokenAccessURL
      )
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal(
        Settings.adminUrl + otherUsersProjectTokenAccessURL
      )
    })
    it('should display token access page for regular user', async function () {
      await displayTokenAccessPage(otherUser)
    })
  })
})
