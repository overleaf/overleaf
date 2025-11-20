import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import request from './helpers/request.js'
import settings from '@overleaf/settings'
import Features from '../../../app/src/infrastructure/Features.mjs'
import expectErrorResponse from './helpers/expectErrorResponse.mjs'
import { promisify } from '@overleaf/promise-utils'

const User = UserHelper.promises

async function tryReadAccess(user, projectId, test) {
  const projectRequest = await user.doRequest('get', `/project/${projectId}`)
  test(projectRequest.response, projectRequest.body)
  const zipRequest = await user.doRequest(
    'get',
    `/project/${projectId}/download/zip`
  )
  test(zipRequest.response, zipRequest.body)
}

async function tryRenameProjectAccess(user, projectId, test) {
  const { response, body } = await user.doRequest('post', {
    url: `/project/${projectId}/settings`,
    json: { name: 'new name' },
  })
  test(response, body)
}

async function trySettingsWriteAccess(user, projectId, test) {
  const { response, body } = await user.doRequest('post', {
    url: `/project/${projectId}/settings`,
    json: { compiler: 'latex' },
  })
  test(response, body)
}

async function tryProjectAdminAccess(user, projectId, test) {
  const renameRequest = await user.doRequest('post', {
    url: `/project/${projectId}/rename`,
    json: { newProjectName: 'new-name' },
  })
  test(renameRequest.response, renameRequest.body)
  const settingsRequest = await user.doRequest('post', {
    url: `/project/${projectId}/settings/admin`,
    json: { publicAccessLevel: 'private' },
  })
  test(settingsRequest.response, settingsRequest.body)
}

async function tryAdminAccess(user, test) {
  const { response, body } = await user.doRequest('get', '/admin')
  test(response, body)

  if (Features.hasFeature('saas')) {
    const { response, body } = await user.doRequest(
      'get',
      `/admin/user/${user._id}`
    )
    test(response, body)
  }
}

function tryContentAccessCb(user, projectId, test, callback) {
  // The real-time service calls this end point to determine the user's
  // permissions.
  let userId
  if (user.id != null) {
    userId = user.id
  } else {
    userId = 'anonymous-user'
  }
  request.post(
    {
      url: `/project/${projectId}/join`,
      auth: {
        user: settings.apis.web.user,
        pass: settings.apis.web.pass,
        sendImmediately: true,
      },
      json: { userId },
      jar: false,
    },
    (error, response, body) => {
      if (error != null) {
        return callback(error)
      }
      test(response, body)
      callback()
    }
  )
}

const tryContentAccess = promisify(tryContentAccessCb)

async function expectAdminAccess(user) {
  await tryAdminAccess(user, response =>
    expect(response.statusCode).to.be.oneOf([200, 204])
  )
}

async function expectRedirectedAdminAccess(user) {
  await tryAdminAccess(user, response => {
    expect(response.statusCode).to.equal(302)
    expect(response.headers.location).to.equal(
      settings.adminUrl + response.request.uri.pathname
    )
  })
}

async function expectReadAccess(user, projectId) {
  await tryReadAccess(user, projectId, response =>
    expect(response.statusCode).to.be.oneOf([200, 204])
  )
  await tryContentAccess(user, projectId, (response, body) =>
    expect(body.privilegeLevel).to.be.oneOf([
      'owner',
      'readAndWrite',
      'readOnly',
    ])
  )
}

async function expectContentWriteAccess(user, projectId) {
  await tryContentAccess(user, projectId, (response, body) =>
    expect(body.privilegeLevel).to.be.oneOf(['owner', 'readAndWrite'])
  )
}

async function expectRenameProjectAccess(user, projectId) {
  await tryRenameProjectAccess(user, projectId, response => {
    expect(response.statusCode).to.be.oneOf([200, 204])
  })
}

async function expectSettingsWriteAccess(user, projectId) {
  await trySettingsWriteAccess(user, projectId, response =>
    expect(response.statusCode).to.be.oneOf([200, 204])
  )
}

async function expectProjectAdminAccess(user, projectId) {
  await tryProjectAdminAccess(user, projectId, response =>
    expect(response.statusCode).to.be.oneOf([200, 204])
  )
}

async function expectNoReadAccess(user, projectId) {
  await tryReadAccess(user, projectId, expectErrorResponse.restricted.html)
  await tryContentAccess(user, projectId, (response, body) => {
    expect(response.statusCode).to.equal(403)
    expect(body).to.equal('Forbidden')
  })
}

async function expectNoContentWriteAccess(user, projectId) {
  await tryContentAccess(user, projectId, (response, body) =>
    expect(body.privilegeLevel).to.be.oneOf([undefined, null, 'readOnly'])
  )
}

async function expectNoSettingsWriteAccess(user, projectId) {
  await trySettingsWriteAccess(
    user,
    projectId,
    expectErrorResponse.restricted.json
  )
}

async function expectNoRenameProjectAccess(user, projectId) {
  await tryRenameProjectAccess(
    user,
    projectId,
    expectErrorResponse.restricted.json
  )
}

async function expectNoProjectAdminAccess(user, projectId) {
  await tryProjectAdminAccess(user, projectId, response => {
    expect(response.statusCode).to.equal(403)
  })
}

async function expectNoAnonymousProjectAdminAccess(user, projectId) {
  await tryProjectAdminAccess(
    user,
    projectId,
    expectErrorResponse.requireLogin.json
  )
}

async function expectChatAccess(user, projectId) {
  const { response } = await user.doRequest(
    'get',
    `/project/${projectId}/messages`
  )
  expect(response.statusCode).to.equal(200)
}

async function expectNoChatAccess(user, projectId) {
  const { response } = await user.doRequest(
    'get',
    `/project/${projectId}/messages`
  )
  expect(response.statusCode).to.equal(403)
}

describe('Authorization', function () {
  beforeEach(async function () {
    this.timeout(90000)
    this.owner = new User()
    this.other1 = new User()
    this.other2 = new User()
    this.anon = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    settings.adminRolesEnabled = false
    await Promise.all([
      this.owner.login(),
      this.other1.login(),
      this.other2.login(),
      this.anon.getCsrfToken(),
      (async () => {
        await this.site_admin.ensureUserExists()
        await this.site_admin.ensureAdmin()
        await this.site_admin.login()
      })(),
    ])
  })

  describe('private project', function () {
    beforeEach(async function () {
      this.projectId = await this.owner.createProject('private-project')
    })

    it('should allow the owner read access to it', async function () {
      await expectReadAccess(this.owner, this.projectId)
    })

    it('should allow the owner write access to its content', async function () {
      await expectContentWriteAccess(this.owner, this.projectId)
    })

    it('should allow the owner write access to its settings', async function () {
      await expectSettingsWriteAccess(this.owner, this.projectId)
    })

    it('should allow the owner to rename the project', async function () {
      await expectRenameProjectAccess(this.owner, this.projectId)
    })

    it('should allow the owner project admin access to it', async function () {
      await expectProjectAdminAccess(this.owner, this.projectId)
    })

    it('should allow the owner user chat messages access', async function () {
      await expectChatAccess(this.owner, this.projectId)
    })

    it('should not allow another user read access to the project', async function () {
      await expectNoReadAccess(this.other1, this.projectId)
    })

    it('should not allow another user write access to its content', async function () {
      await expectNoContentWriteAccess(this.other1, this.projectId)
    })

    it('should not allow another user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.other1, this.projectId)
    })

    it('should not allow another user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.other1, this.projectId)
    })

    it('should not allow another user project admin access to it', async function () {
      await expectNoProjectAdminAccess(this.other1, this.projectId)
    })

    it('should not allow another user chat messages access', async function () {
      await expectNoChatAccess(this.other1, this.projectId)
    })

    it('should not allow anonymous user read access to it', async function () {
      await expectNoReadAccess(this.anon, this.projectId)
    })

    it('should not allow anonymous user write access to its content', async function () {
      await expectNoContentWriteAccess(this.anon, this.projectId)
    })

    it('should not allow anonymous user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.anon, this.projectId)
    })

    it('should not allow anonymous user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.anon, this.projectId)
    })

    it('should not allow anonymous user project admin access to it', async function () {
      await expectNoAnonymousProjectAdminAccess(this.anon, this.projectId)
    })

    it('should not allow anonymous user chat messages access', async function () {
      await expectNoChatAccess(this.anon, this.projectId)
    })

    describe('with admin privilege available', function () {
      beforeEach(function () {
        settings.adminPrivilegeAvailable = true
      })

      it('should allow site admin users read access to it', async function () {
        await expectReadAccess(this.site_admin, this.projectId)
      })

      it('should allow site admin users write access to its content', async function () {
        await expectContentWriteAccess(this.site_admin, this.projectId)
      })

      it('should allow site admin users write access to its settings', async function () {
        await expectSettingsWriteAccess(this.site_admin, this.projectId)
      })

      it('should allow site admin users to rename the project', async function () {
        await expectRenameProjectAccess(this.site_admin, this.projectId)
      })

      it('should allow site admin users project admin access to it', async function () {
        await expectProjectAdminAccess(this.site_admin, this.projectId)
      })

      it('should allow site admin users site admin access to site admin endpoints', async function () {
        await expectAdminAccess(this.site_admin)
      })
    })

    describe('with admin privilege unavailable', function () {
      beforeEach(function () {
        settings.adminPrivilegeAvailable = false
      })
      afterEach(function () {
        settings.adminPrivilegeAvailable = true
      })

      it('should not allow site admin users read access to it', async function () {
        await expectNoReadAccess(this.site_admin, this.projectId)
      })

      it('should not allow site admin users write access to its content', async function () {
        await expectNoContentWriteAccess(this.site_admin, this.projectId)
      })

      it('should not allow site admin users write access to its settings', async function () {
        await expectNoSettingsWriteAccess(this.site_admin, this.projectId)
      })

      it('should not allow site admin users to rename the project', async function () {
        await expectNoRenameProjectAccess(this.site_admin, this.projectId)
      })

      it('should not allow site admin users project admin access to it', async function () {
        await expectNoProjectAdminAccess(this.site_admin, this.projectId)
      })

      it('should redirect site admin users when accessing site admin endpoints', async function () {
        await expectRedirectedAdminAccess(this.site_admin)
      })
    })

    describe('with admin roles', function () {
      beforeEach(function () {
        if (!settings.moduleImportSequence.includes('admin-roles')) {
          this.skip()
        }
        settings.adminRolesEnabled = true
        settings.adminPrivilegeAvailable = true
      })

      afterEach(function () {
        settings.adminRolesEnabled = false
        settings.adminPrivilegeAvailable = true
        this.site_admin.mongoUpdate({
          $set: { adminRoles: [] },
        })
      })

      describe('engineering', function () {
        beforeEach(function () {
          this.site_admin.mongoUpdate({
            $set: { adminRoles: ['engineering'] },
          })
        })

        it('should allow site admin users read access to it', async function () {
          await expectReadAccess(this.site_admin, this.projectId)
        })

        it('should not allow site admin users write access to its content', async function () {
          await expectNoContentWriteAccess(this.site_admin, this.projectId)
        })

        it('should allow site admin users write access to its settings', async function () {
          await expectSettingsWriteAccess(this.site_admin, this.projectId)
        })

        it('should allow site admin users to rename the project', async function () {
          await expectRenameProjectAccess(this.site_admin, this.projectId)
        })

        it('should allow site admin users project admin access to it', async function () {
          await expectProjectAdminAccess(this.site_admin, this.projectId)
        })

        it('should allow site admin users site admin access to site admin endpoints', async function () {
          await expectAdminAccess(this.site_admin)
        })
      })
      describe('no admin role assigned', function () {
        beforeEach(function () {
          this.site_admin.mongoUpdate({
            $set: { adminRoles: [] },
          })
        })

        it('should not allow site admin users read access to it', async function () {
          await expectNoReadAccess(this.site_admin, this.projectId)
        })

        it('should not allow site admin users write access to its content', async function () {
          await expectNoContentWriteAccess(this.site_admin, this.projectId)
        })

        it('should not allow site admin users write access to its settings', async function () {
          await expectNoSettingsWriteAccess(this.site_admin, this.projectId)
        })

        it('should not allow site admin users to rename the project', async function () {
          await expectNoRenameProjectAccess(this.site_admin, this.projectId)
        })

        it('should not allow site admin users project admin access to it', async function () {
          await expectNoProjectAdminAccess(this.site_admin, this.projectId)
        })

        it('should allow site admin users site admin access to site admin endpoints', async function () {
          await expectAdminAccess(this.site_admin)
        })
      })
    })
  })

  describe('shared project', function () {
    beforeEach(async function () {
      this.rw_user = this.other1
      this.ro_user = this.other2
      this.projectId = await this.owner.createProject('private-project')
      await this.owner.addUserToProject(
        this.projectId,
        this.ro_user,
        'readOnly'
      )
      await this.owner.addUserToProject(
        this.projectId,
        this.rw_user,
        'readAndWrite'
      )
    })

    it('should allow the read-only user read access to it', async function () {
      await expectReadAccess(this.ro_user, this.projectId)
    })

    it('should allow the read-only user chat messages access', async function () {
      await expectChatAccess(this.ro_user, this.projectId)
    })

    it('should not allow the read-only user write access to its content', async function () {
      await expectNoContentWriteAccess(this.ro_user, this.projectId)
    })

    it('should not allow the read-only user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.ro_user, this.projectId)
    })

    it('should not allow the read-only user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.ro_user, this.projectId)
    })

    it('should not allow the read-only user project admin access to it', async function () {
      await expectNoProjectAdminAccess(this.ro_user, this.projectId)
    })

    it('should allow the read-write user read access to it', async function () {
      await expectReadAccess(this.rw_user, this.projectId)
    })

    it('should allow the read-write user write access to its content', async function () {
      await expectContentWriteAccess(this.rw_user, this.projectId)
    })

    it('should allow the read-write user write access to its settings', async function () {
      await expectSettingsWriteAccess(this.rw_user, this.projectId)
    })

    it('should not allow the read-write user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.rw_user, this.projectId)
    })

    it('should not allow the read-write user project admin access to it', async function () {
      await expectNoProjectAdminAccess(this.rw_user, this.projectId)
    })

    it('should allow the read-write user chat messages access', async function () {
      await expectChatAccess(this.rw_user, this.projectId)
    })
  })

  describe('public read-write project', function () {
    /**
     * Note: this is a test for the legacy "public access" feature.
     * See documentation comment in `Authorization/PublicAccessLevels`
     * */
    beforeEach(async function () {
      this.projectId = await this.owner.createProject('public-rw-project')
      await this.owner.makePublic(this.projectId, 'readAndWrite')
    })

    it('should allow a user read access to it', async function () {
      await expectReadAccess(this.other1, this.projectId)
    })

    it('should allow a user write access to its content', async function () {
      await expectContentWriteAccess(this.other1, this.projectId)
    })

    it('should allow a user chat messages access', async function () {
      await expectChatAccess(this.other1, this.projectId)
    })

    it('should not allow a user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.other1, this.projectId)
    })

    it('should not allow a user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.other1, this.projectId)
    })

    it('should not allow a user project admin access to it', async function () {
      await expectNoProjectAdminAccess(this.other1, this.projectId)
    })

    it('should allow an anonymous user read access to it', async function () {
      await expectReadAccess(this.anon, this.projectId)
    })

    it('should allow an anonymous user write access to its content', async function () {
      await expectContentWriteAccess(this.anon, this.projectId)
    })

    it('should allow an anonymous user chat messages access', async function () {
      // chat access for anonymous users is a CE/SP-only feature, although currently broken
      // https://github.com/overleaf/internal/issues/10944
      if (Features.hasFeature('saas')) {
        this.skip()
      }
      await expectChatAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user project admin access to it', async function () {
      await expectNoAnonymousProjectAdminAccess(this.anon, this.projectId)
    })
  })

  describe('public read-only project', function () {
    /**
     * Note: this is a test for the legacy "public access" feature.
     * See documentation comment in `Authorization/PublicAccessLevels`
     * */
    beforeEach(async function () {
      this.projectId = await this.owner.createProject('public-ro-project')
      await this.owner.makePublic(this.projectId, 'readOnly')
    })

    it('should allow a user read access to it', async function () {
      await expectReadAccess(this.other1, this.projectId)
    })

    it('should not allow a user write access to its content', async function () {
      await expectNoContentWriteAccess(this.other1, this.projectId)
    })

    it('should not allow a user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.other1, this.projectId)
    })

    it('should not allow a user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.other1, this.projectId)
    })

    it('should not allow a user project admin access to it', async function () {
      await expectNoProjectAdminAccess(this.other1, this.projectId)
    })

    // NOTE: legacy readOnly access does not count as 'restricted' in the new model
    it('should allow a user chat messages access', async function () {
      await expectChatAccess(this.other1, this.projectId)
    })

    it('should allow an anonymous user read access to it', async function () {
      await expectReadAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user write access to its content', async function () {
      await expectNoContentWriteAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user write access to its settings', async function () {
      await expectNoSettingsWriteAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user to rename the project', async function () {
      await expectNoRenameProjectAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user project admin access to it', async function () {
      await expectNoAnonymousProjectAdminAccess(this.anon, this.projectId)
    })

    it('should not allow an anonymous user chat messages access', async function () {
      await expectNoChatAccess(this.anon, this.projectId)
    })
  })
})
