import { expect } from 'chai'
import async from 'async'
import User from './helpers/User.mjs'
import request from './helpers/request.js'
import settings from '@overleaf/settings'
import Features from '../../../app/src/infrastructure/Features.js'
import expectErrorResponse from './helpers/expectErrorResponse.mjs'

function tryReadAccess(user, projectId, test, callback) {
  async.series(
    [
      cb =>
        user.request.get(`/project/${projectId}`, (error, response, body) => {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          cb()
        }),
      cb =>
        user.request.get(
          `/project/${projectId}/download/zip`,
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        ),
    ],
    callback
  )
}

function tryRenameProjectAccess(user, projectId, test, callback) {
  user.request.post(
    {
      uri: `/project/${projectId}/settings`,
      json: {
        name: 'new name',
      },
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

function trySettingsWriteAccess(user, projectId, test, callback) {
  async.series(
    [
      cb =>
        user.request.post(
          {
            uri: `/project/${projectId}/settings`,
            json: {
              compiler: 'latex',
            },
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        ),
    ],
    callback
  )
}

function tryProjectAdminAccess(user, projectId, test, callback) {
  async.series(
    [
      cb =>
        user.request.post(
          {
            uri: `/project/${projectId}/rename`,
            json: {
              newProjectName: 'new-name',
            },
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        ),
      cb =>
        user.request.post(
          {
            uri: `/project/${projectId}/settings/admin`,
            json: {
              publicAccessLevel: 'private',
            },
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        ),
    ],
    callback
  )
}

function tryAdminAccess(user, test, callback) {
  async.series(
    [
      cb =>
        user.request.get(
          {
            uri: '/admin',
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        ),
      cb => {
        if (!Features.hasFeature('saas')) {
          return cb()
        }
        user.request.get(
          {
            uri: `/admin/user/${user._id}`,
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        )
      },
    ],
    callback
  )
}

function tryContentAccess(user, projectId, test, callback) {
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

function expectAdminAccess(user, callback) {
  tryAdminAccess(
    user,
    response => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )
}

function expectRedirectedAdminAccess(user, callback) {
  tryAdminAccess(
    user,
    response => {
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.equal(
        settings.adminUrl + response.request.uri.pathname
      )
    },
    callback
  )
}

function expectReadAccess(user, projectId, callback) {
  async.series(
    [
      cb =>
        tryReadAccess(
          user,
          projectId,
          (response, body) =>
            expect(response.statusCode).to.be.oneOf([200, 204]),
          cb
        ),
      cb =>
        tryContentAccess(
          user,
          projectId,
          (response, body) =>
            expect(body.privilegeLevel).to.be.oneOf([
              'owner',
              'readAndWrite',
              'readOnly',
            ]),
          cb
        ),
    ],
    callback
  )
}

function expectContentWriteAccess(user, projectId, callback) {
  tryContentAccess(
    user,
    projectId,
    (response, body) =>
      expect(body.privilegeLevel).to.be.oneOf(['owner', 'readAndWrite']),
    callback
  )
}

function expectRenameProjectAccess(user, projectId, callback) {
  tryRenameProjectAccess(
    user,
    projectId,
    (response, body) => {
      expect(response.statusCode).to.be.oneOf([200, 204])
    },
    callback
  )
}

function expectSettingsWriteAccess(user, projectId, callback) {
  trySettingsWriteAccess(
    user,
    projectId,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )
}

function expectProjectAdminAccess(user, projectId, callback) {
  tryProjectAdminAccess(
    user,
    projectId,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )
}

function expectNoReadAccess(user, projectId, callback) {
  async.series(
    [
      cb =>
        tryReadAccess(user, projectId, expectErrorResponse.restricted.html, cb),
      cb =>
        tryContentAccess(
          user,
          projectId,
          (response, body) => {
            expect(response.statusCode).to.equal(403)
            expect(body).to.equal('Forbidden')
          },
          cb
        ),
    ],
    callback
  )
}

function expectNoContentWriteAccess(user, projectId, callback) {
  tryContentAccess(
    user,
    projectId,
    (response, body) =>
      expect(body.privilegeLevel).to.be.oneOf([undefined, null, 'readOnly']),
    callback
  )
}

function expectNoSettingsWriteAccess(user, projectId, callback) {
  trySettingsWriteAccess(
    user,
    projectId,
    expectErrorResponse.restricted.json,
    callback
  )
}

function expectNoRenameProjectAccess(user, projectId, callback) {
  tryRenameProjectAccess(
    user,
    projectId,
    expectErrorResponse.restricted.json,
    callback
  )
}

function expectNoProjectAdminAccess(user, projectId, callback) {
  tryProjectAdminAccess(
    user,
    projectId,
    (response, body) => {
      expect(response.statusCode).to.equal(403)
    },
    callback
  )
}

function expectNoAnonymousProjectAdminAccess(user, projectId, callback) {
  tryProjectAdminAccess(
    user,
    projectId,
    expectErrorResponse.requireLogin.json,
    callback
  )
}

function expectChatAccess(user, projectId, callback) {
  user.request.get(
    {
      url: `/project/${projectId}/messages`,
      json: true,
    },
    (error, response) => {
      if (error != null) {
        return callback(error)
      }
      expect(response.statusCode).to.equal(200)
      callback()
    }
  )
}

function expectNoChatAccess(user, projectId, callback) {
  user.request.get(
    {
      url: `/project/${projectId}/messages`,
      json: true,
    },
    (error, response) => {
      if (error != null) {
        return callback(error)
      }
      expect(response.statusCode).to.equal(403)
      callback()
    }
  )
}

describe('Authorization', function () {
  beforeEach(function (done) {
    this.timeout(90000)
    this.owner = new User()
    this.other1 = new User()
    this.other2 = new User()
    this.anon = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    async.parallel(
      [
        cb => this.owner.login(cb),
        cb => this.other1.login(cb),
        cb => this.other2.login(cb),
        cb => this.anon.getCsrfToken(cb),
        cb => {
          this.site_admin.ensureUserExists(err => {
            if (err) return cb(err)
            this.site_admin.ensureAdmin(err => {
              if (err != null) {
                return cb(err)
              }
              return this.site_admin.login(cb)
            })
          })
        },
      ],
      done
    )
  })

  describe('private project', function () {
    beforeEach(function (done) {
      this.owner.createProject('private-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        done()
      })
    })

    it('should allow the owner read access to it', function (done) {
      expectReadAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner write access to its content', function (done) {
      expectContentWriteAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner write access to its settings', function (done) {
      expectSettingsWriteAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner to rename the project', function (done) {
      expectRenameProjectAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner project admin access to it', function (done) {
      expectProjectAdminAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner user chat messages access', function (done) {
      expectChatAccess(this.owner, this.projectId, done)
    })

    it('should not allow another user read access to the project', function (done) {
      expectNoReadAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user write access to its content', function (done) {
      expectNoContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user project admin access to it', function (done) {
      expectNoProjectAdminAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user chat messages access', function (done) {
      expectNoChatAccess(this.other1, this.projectId, done)
    })

    it('should not allow anonymous user read access to it', function (done) {
      expectNoReadAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user write access to its content', function (done) {
      expectNoContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user project admin access to it', function (done) {
      expectNoAnonymousProjectAdminAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user chat messages access', function (done) {
      expectNoChatAccess(this.anon, this.projectId, done)
    })

    describe('with admin privilege available', function () {
      beforeEach(function () {
        settings.adminPrivilegeAvailable = true
      })

      it('should allow site admin users read access to it', function (done) {
        expectReadAccess(this.site_admin, this.projectId, done)
      })

      it('should allow site admin users write access to its content', function (done) {
        expectContentWriteAccess(this.site_admin, this.projectId, done)
      })

      it('should allow site admin users write access to its settings', function (done) {
        expectSettingsWriteAccess(this.site_admin, this.projectId, done)
      })

      it('should allow site admin users to rename the project', function (done) {
        expectRenameProjectAccess(this.site_admin, this.projectId, done)
      })

      it('should allow site admin users project admin access to it', function (done) {
        expectProjectAdminAccess(this.site_admin, this.projectId, done)
      })

      it('should allow site admin users site admin access to site admin endpoints', function (done) {
        expectAdminAccess(this.site_admin, done)
      })
    })

    describe('with admin privilege unavailable', function () {
      beforeEach(function () {
        settings.adminPrivilegeAvailable = false
      })
      afterEach(function () {
        settings.adminPrivilegeAvailable = true
      })

      it('should not allow site admin users read access to it', function (done) {
        expectNoReadAccess(this.site_admin, this.projectId, done)
      })

      it('should not allow site admin users write access to its content', function (done) {
        expectNoContentWriteAccess(this.site_admin, this.projectId, done)
      })

      it('should not allow site admin users write access to its settings', function (done) {
        expectNoSettingsWriteAccess(this.site_admin, this.projectId, done)
      })

      it('should not allow site admin users to rename the project', function (done) {
        expectNoRenameProjectAccess(this.site_admin, this.projectId, done)
      })

      it('should not allow site admin users project admin access to it', function (done) {
        expectNoProjectAdminAccess(this.site_admin, this.projectId, done)
      })

      it('should redirect site admin users when accessing site admin endpoints', function (done) {
        expectRedirectedAdminAccess(this.site_admin, done)
      })
    })
  })

  describe('shared project', function () {
    beforeEach(function (done) {
      this.rw_user = this.other1
      this.ro_user = this.other2
      this.owner.createProject('private-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        this.owner.addUserToProject(
          this.projectId,
          this.ro_user,
          'readOnly',
          error => {
            if (error != null) {
              return done(error)
            }
            this.owner.addUserToProject(
              this.projectId,
              this.rw_user,
              'readAndWrite',
              error => {
                if (error != null) {
                  return done(error)
                }
                done()
              }
            )
          }
        )
      })
    })

    it('should allow the read-only user read access to it', function (done) {
      expectReadAccess(this.ro_user, this.projectId, done)
    })

    it('should allow the read-only user chat messages access', function (done) {
      expectChatAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user write access to its content', function (done) {
      expectNoContentWriteAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user project admin access to it', function (done) {
      expectNoProjectAdminAccess(this.ro_user, this.projectId, done)
    })

    it('should allow the read-write user read access to it', function (done) {
      expectReadAccess(this.rw_user, this.projectId, done)
    })

    it('should allow the read-write user write access to its content', function (done) {
      expectContentWriteAccess(this.rw_user, this.projectId, done)
    })

    it('should allow the read-write user write access to its settings', function (done) {
      expectSettingsWriteAccess(this.rw_user, this.projectId, done)
    })

    it('should not allow the read-write user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.rw_user, this.projectId, done)
    })

    it('should not allow the read-write user project admin access to it', function (done) {
      expectNoProjectAdminAccess(this.rw_user, this.projectId, done)
    })

    it('should allow the read-write user chat messages access', function (done) {
      expectChatAccess(this.rw_user, this.projectId, done)
    })
  })

  describe('public read-write project', function () {
    /**
     * Note: this is a test for the legacy "public access" feature.
     * See documentation comment in `Authorization/PublicAccessLevels`
     * */
    beforeEach(function (done) {
      this.owner.createProject('public-rw-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        this.owner.makePublic(this.projectId, 'readAndWrite', done)
      })
    })

    it('should allow a user read access to it', function (done) {
      expectReadAccess(this.other1, this.projectId, done)
    })

    it('should allow a user write access to its content', function (done) {
      expectContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should allow a user chat messages access', function (done) {
      expectChatAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user project admin access to it', function (done) {
      expectNoProjectAdminAccess(this.other1, this.projectId, done)
    })

    it('should allow an anonymous user read access to it', function (done) {
      expectReadAccess(this.anon, this.projectId, done)
    })

    it('should allow an anonymous user write access to its content', function (done) {
      expectContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should allow an anonymous user chat messages access', function (done) {
      // chat access for anonymous users is a CE/SP-only feature, although currently broken
      // https://github.com/overleaf/internal/issues/10944
      if (Features.hasFeature('saas')) {
        this.skip()
      }
      expectChatAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user project admin access to it', function (done) {
      expectNoAnonymousProjectAdminAccess(this.anon, this.projectId, done)
    })
  })

  describe('public read-only project', function () {
    /**
     * Note: this is a test for the legacy "public access" feature.
     * See documentation comment in `Authorization/PublicAccessLevels`
     * */
    beforeEach(function (done) {
      this.owner.createProject('public-ro-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        this.owner.makePublic(this.projectId, 'readOnly', done)
      })
    })

    it('should allow a user read access to it', function (done) {
      expectReadAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its content', function (done) {
      expectNoContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user project admin access to it', function (done) {
      expectNoProjectAdminAccess(this.other1, this.projectId, done)
    })

    // NOTE: legacy readOnly access does not count as 'restricted' in the new model
    it('should allow a user chat messages access', function (done) {
      expectChatAccess(this.other1, this.projectId, done)
    })

    it('should allow an anonymous user read access to it', function (done) {
      expectReadAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its content', function (done) {
      expectNoContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its settings', function (done) {
      expectNoSettingsWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user to rename the project', function (done) {
      expectNoRenameProjectAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user project admin access to it', function (done) {
      expectNoAnonymousProjectAdminAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user chat messages access', function (done) {
      expectNoChatAccess(this.anon, this.projectId, done)
    })
  })
})
