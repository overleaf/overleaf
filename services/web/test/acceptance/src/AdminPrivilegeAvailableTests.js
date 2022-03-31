const Settings = require('@overleaf/settings')
const { expect } = require('chai')
const User = require('./helpers/User').promises

describe('AdminPrivilegeAvailable', function () {
  let adminUser
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

  let projectIdOwned, otherUsersProjectId
  beforeEach('create owned project', async function () {
    projectIdOwned = await adminUser.createProject('owned project')
  })

  beforeEach('create other user and project', async function () {
    const otherUser = new User()
    await otherUser.login()

    otherUsersProjectId = await otherUser.createProject('other users project')
  })

  async function hasAccess(projectId) {
    const { response } = await adminUser.doRequest(
      'GET',
      `/project/${projectId}`
    )
    return response.statusCode === 200
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
  })
})
