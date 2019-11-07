const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')

require('./helpers/MockDocstoreApi')
require('./helpers/MockDocUpdaterApi')

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
        )
    ],
    callback
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
              compiler: 'latex'
            }
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        )
    ],
    callback
  )
}

function tryAdminAccess(user, projectId, test, callback) {
  async.series(
    [
      cb =>
        user.request.post(
          {
            uri: `/project/${projectId}/rename`,
            json: {
              newProjectName: 'new-name'
            }
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
              publicAccessLevel: 'private'
            }
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            cb()
          }
        )
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
      qs: { user_id: userId },
      auth: {
        user: settings.apis.web.user,
        pass: settings.apis.web.pass,
        sendImmediately: true
      },
      json: true,
      jar: false
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
              'readOnly'
            ]),
          cb
        )
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

function expectSettingsWriteAccess(user, projectId, callback) {
  trySettingsWriteAccess(
    user,
    projectId,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )
}

function expectAdminAccess(user, projectId, callback) {
  tryAdminAccess(
    user,
    projectId,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )
}

function expectNoReadAccess(user, projectId, options, callback) {
  async.series(
    [
      cb =>
        tryReadAccess(
          user,
          projectId,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            expect(response.headers.location).to.match(
              new RegExp(options.redirect_to)
            )
          },
          cb
        ),
      cb =>
        tryContentAccess(
          user,
          projectId,
          (response, body) => {
            expect(response.statusCode).to.equal(403)
            expect(body).to.equal('Forbidden')
          },
          cb
        )
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

function expectNoSettingsWriteAccess(user, projectId, options, callback) {
  trySettingsWriteAccess(
    user,
    projectId,
    (response, body) => {
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.match(
        new RegExp(options.redirect_to)
      )
    },
    callback
  )
}

function expectNoAdminAccess(user, projectId, callback) {
  tryAdminAccess(
    user,
    projectId,
    (response, body) => {
      expect(response.statusCode).to.equal(403)
    },
    callback
  )
}

function expectNoAnonymousAdminAccess(user, projectId, callback) {
  tryAdminAccess(
    user,
    projectId,
    (response, body) => {
      expect(response.statusCode).to.equal(302)
      expect(response.headers.location).to.match(/^\/login/)
    },
    callback
  )
}

describe('Authorization', function() {
  beforeEach(function(done) {
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
          this.site_admin.login(err => {
            if (err != null) {
              return cb(err)
            }
            return this.site_admin.ensureAdmin(cb)
          })
        }
      ],
      done
    )
  })

  describe('private project', function() {
    beforeEach(function(done) {
      this.owner.createProject('private-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        done()
      })
    })

    it('should allow the owner read access to it', function(done) {
      expectReadAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner write access to its content', function(done) {
      expectContentWriteAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner write access to its settings', function(done) {
      expectSettingsWriteAccess(this.owner, this.projectId, done)
    })

    it('should allow the owner admin access to it', function(done) {
      expectAdminAccess(this.owner, this.projectId, done)
    })

    it('should not allow another user read access to the project', function(done) {
      expectNoReadAccess(
        this.other1,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow another user write access to its content', function(done) {
      expectNoContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow another user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.other1,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow another user admin access to it', function(done) {
      expectNoAdminAccess(this.other1, this.projectId, done)
    })

    it('should not allow anonymous user read access to it', function(done) {
      expectNoReadAccess(
        this.anon,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow anonymous user write access to its content', function(done) {
      expectNoContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow anonymous user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.anon,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow anonymous user admin access to it', function(done) {
      expectNoAnonymousAdminAccess(this.anon, this.projectId, done)
    })

    it('should allow site admin users read access to it', function(done) {
      expectReadAccess(this.site_admin, this.projectId, done)
    })

    it('should allow site admin users write access to its content', function(done) {
      expectContentWriteAccess(this.site_admin, this.projectId, done)
    })

    it('should allow site admin users write access to its settings', function(done) {
      expectSettingsWriteAccess(this.site_admin, this.projectId, done)
    })

    it('should allow site admin users admin access to it', function(done) {
      expectAdminAccess(this.site_admin, this.projectId, done)
    })
  })

  describe('shared project', function() {
    beforeEach(function(done) {
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

    it('should allow the read-only user read access to it', function(done) {
      expectReadAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user write access to its content', function(done) {
      expectNoContentWriteAccess(this.ro_user, this.projectId, done)
    })

    it('should not allow the read-only user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.ro_user,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow the read-only user admin access to it', function(done) {
      expectNoAdminAccess(this.ro_user, this.projectId, done)
    })

    it('should allow the read-write user read access to it', function(done) {
      expectReadAccess(this.rw_user, this.projectId, done)
    })

    it('should allow the read-write user write access to its content', function(done) {
      expectContentWriteAccess(this.rw_user, this.projectId, done)
    })

    it('should allow the read-write user write access to its settings', function(done) {
      expectSettingsWriteAccess(this.rw_user, this.projectId, done)
    })

    it('should not allow the read-write user admin access to it', function(done) {
      expectNoAdminAccess(this.rw_user, this.projectId, done)
    })
  })

  describe('public read-write project', function() {
    beforeEach(function(done) {
      this.owner.createProject('public-rw-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        this.owner.makePublic(this.projectId, 'readAndWrite', done)
      })
    })

    it('should allow a user read access to it', function(done) {
      expectReadAccess(this.other1, this.projectId, done)
    })

    it('should allow a user write access to its content', function(done) {
      expectContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.other1,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow a user admin access to it', function(done) {
      expectNoAdminAccess(this.other1, this.projectId, done)
    })

    it('should allow an anonymous user read access to it', function(done) {
      expectReadAccess(this.anon, this.projectId, done)
    })

    it('should allow an anonymous user write access to its content', function(done) {
      expectContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.anon,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow an anonymous user admin access to it', function(done) {
      expectNoAnonymousAdminAccess(this.anon, this.projectId, done)
    })
  })

  describe('public read-only project', function() {
    beforeEach(function(done) {
      this.owner.createProject('public-ro-project', (error, projectId) => {
        if (error != null) {
          return done(error)
        }
        this.projectId = projectId
        this.owner.makePublic(this.projectId, 'readOnly', done)
      })
    })

    it('should allow a user read access to it', function(done) {
      expectReadAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its content', function(done) {
      expectNoContentWriteAccess(this.other1, this.projectId, done)
    })

    it('should not allow a user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.other1,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow a user admin access to it', function(done) {
      expectNoAdminAccess(this.other1, this.projectId, done)
    })

    it('should allow an anonymous user read access to it', function(done) {
      expectReadAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its content', function(done) {
      expectNoContentWriteAccess(this.anon, this.projectId, done)
    })

    it('should not allow an anonymous user write access to its settings', function(done) {
      expectNoSettingsWriteAccess(
        this.anon,
        this.projectId,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow an anonymous user admin access to it', function(done) {
      expectNoAnonymousAdminAccess(this.anon, this.projectId, done)
    })
  })
})
