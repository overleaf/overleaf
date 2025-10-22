import Settings from '@overleaf/settings'
import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import UrlHelper from '../../../app/src/Features/Helpers/UrlHelper.mjs'

const { getSafeAdminDomainRedirect } = UrlHelper
const User = UserHelper.promises

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
    await adminUser.ensureAdminRole('engineering')
    await adminUser.login()
  })

  let projectIdOwned, otherUsersProjectId, otherUsersProjectTokenAccessURL
  beforeEach('create owned project', async function () {
    projectIdOwned = await adminUser.createProject('owned project')
  })

  beforeEach('create other user and project', async function () {
    otherUser = new User({
      email: 'test@non-staff.com',
      confirmedAt: new Date(),
    })
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
    it('should redirect a token grant request to project page', async function () {
      const { response } = await adminUser.doRequest('POST', {
        url: `${otherUsersProjectTokenAccessURL}/grant`,
        json: {
          confirmedByUser: true,
        },
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body.redirect).to.equal(`/project/${otherUsersProjectId}`)
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
    it('should display token access page for admin', async function () {
      displayTokenAccessPage(adminUser)
    })
    it('should display token access page for regular user', async function () {
      await displayTokenAccessPage(otherUser)
    })
    it('should redirect a token grant request to admin panel if belongs to non-staff', async function () {
      const { response } = await adminUser.doRequest('POST', {
        url: `${otherUsersProjectTokenAccessURL}/grant`,
        json: {
          confirmedByUser: true,
        },
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body.redirect).to.equal(
        getSafeAdminDomainRedirect(otherUsersProjectTokenAccessURL)
      )
    })

    it('should redirect a token grant request to project page if belongs to staff', async function () {
      const staff = new User({
        email: `test@${Settings.adminDomains[0]}`,
        confirmedAt: new Date(),
      })
      await staff.ensureUserExists()
      await staff.ensureAdmin()
      await staff.login()

      const staffProjectId = await staff.createProject('staff user project')
      await staff.makeTokenBased(staffProjectId)
      const {
        tokens: { readOnly: readOnlyTokenAdmin },
      } = await staff.getProject(staffProjectId)
      const staffProjectTokenAccessURL = `/read/${readOnlyTokenAdmin}`

      const { response } = await adminUser.doRequest('POST', {
        url: `${staffProjectTokenAccessURL}/grant`,
        json: {
          confirmedByUser: true,
        },
      })
      expect(response.statusCode).to.equal(200)
      expect(response.body.redirect).to.equal(`/project/${staffProjectId}`)
    })
  })
})
