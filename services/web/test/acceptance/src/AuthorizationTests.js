/* eslint-disable
    camelcase,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')

const MockDocstoreApi = require('./helpers/MockDocstoreApi')
const MockDocUpdaterApi = require('./helpers/MockDocUpdaterApi')

const try_read_access = (user, project_id, test, callback) =>
  async.series(
    [
      cb =>
        user.request.get(`/project/${project_id}`, (error, response, body) => {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          return cb()
        }),
      cb =>
        user.request.get(
          `/project/${project_id}/download/zip`,
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            return cb()
          }
        )
    ],
    callback
  )

const try_settings_write_access = (user, project_id, test, callback) =>
  async.series(
    [
      cb =>
        user.request.post(
          {
            uri: `/project/${project_id}/settings`,
            json: {
              compiler: 'latex'
            }
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            return cb()
          }
        )
    ],
    callback
  )

const try_admin_access = (user, project_id, test, callback) =>
  async.series(
    [
      cb =>
        user.request.post(
          {
            uri: `/project/${project_id}/rename`,
            json: {
              newProjectName: 'new-name'
            }
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            return cb()
          }
        ),
      cb =>
        user.request.post(
          {
            uri: `/project/${project_id}/settings/admin`,
            json: {
              publicAccessLevel: 'private'
            }
          },
          (error, response, body) => {
            if (error != null) {
              return cb(error)
            }
            test(response, body)
            return cb()
          }
        )
    ],
    callback
  )

const try_content_access = function(user, project_id, test, callback) {
  // The real-time service calls this end point to determine the user's
  // permissions.
  let user_id
  if (user.id != null) {
    user_id = user.id
  } else {
    user_id = 'anonymous-user'
  }
  return request.post(
    {
      url: `/project/${project_id}/join`,
      qs: { user_id },
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
      return callback()
    }
  )
}

const expect_read_access = (user, project_id, callback) =>
  async.series(
    [
      cb =>
        try_read_access(
          user,
          project_id,
          (response, body) =>
            expect(response.statusCode).to.be.oneOf([200, 204]),
          cb
        ),
      cb =>
        try_content_access(
          user,
          project_id,
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

const expect_content_write_access = (user, project_id, callback) =>
  try_content_access(
    user,
    project_id,
    (response, body) =>
      expect(body.privilegeLevel).to.be.oneOf(['owner', 'readAndWrite']),
    callback
  )

const expect_settings_write_access = (user, project_id, callback) =>
  try_settings_write_access(
    user,
    project_id,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )

const expect_admin_access = (user, project_id, callback) =>
  try_admin_access(
    user,
    project_id,
    (response, body) => expect(response.statusCode).to.be.oneOf([200, 204]),
    callback
  )

const expect_no_read_access = (user, project_id, options, callback) =>
  async.series(
    [
      cb =>
        try_read_access(
          user,
          project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(response.headers.location).to.match(
              new RegExp(options.redirect_to)
            )
          },
          cb
        ),
      cb =>
        try_content_access(
          user,
          project_id,
          (response, body) => expect(body.privilegeLevel).to.be.equal(false),
          cb
        )
    ],
    callback
  )

const expect_no_content_write_access = (user, project_id, callback) =>
  try_content_access(
    user,
    project_id,
    (response, body) =>
      expect(body.privilegeLevel).to.be.oneOf([false, 'readOnly']),
    callback
  )

const expect_no_settings_write_access = (user, project_id, options, callback) =>
  try_settings_write_access(
    user,
    project_id,
    (response, body) => {
      expect(response.statusCode).to.equal(302)
      return expect(response.headers.location).to.match(
        new RegExp(options.redirect_to)
      )
    },
    callback
  )

const expect_no_admin_access = (user, project_id, options, callback) =>
  try_admin_access(
    user,
    project_id,
    (response, body) => {
      expect(response.statusCode).to.equal(302)
      return expect(response.headers.location).to.match(
        new RegExp(options.redirect_to)
      )
    },
    callback
  )

describe('Authorization', function() {
  beforeEach(function(done) {
    this.timeout(90000)
    this.owner = new User()
    this.other1 = new User()
    this.other2 = new User()
    this.anon = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    return async.parallel(
      [
        cb => this.owner.login(cb),
        cb => this.other1.login(cb),
        cb => this.other2.login(cb),
        cb => this.anon.getCsrfToken(cb),
        cb => {
          return this.site_admin.login(err => {
            if (typeof error !== 'undefined' && error !== null) {
              return cb(err)
            }
            return this.site_admin.ensure_admin(cb)
          })
        }
      ],
      done
    )
  })

  describe('private project', function() {
    beforeEach(function(done) {
      return this.owner.createProject(
        'private-project',
        (error, project_id) => {
          if (error != null) {
            return done(error)
          }
          this.project_id = project_id
          return done()
        }
      )
    })

    it('should allow the owner read access to it', function(done) {
      return expect_read_access(this.owner, this.project_id, done)
    })

    it('should allow the owner write access to its content', function(done) {
      return expect_content_write_access(this.owner, this.project_id, done)
    })

    it('should allow the owner write access to its settings', function(done) {
      return expect_settings_write_access(this.owner, this.project_id, done)
    })

    it('should allow the owner admin access to it', function(done) {
      return expect_admin_access(this.owner, this.project_id, done)
    })

    it('should not allow another user read access to the project', function(done) {
      return expect_no_read_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow another user write access to its content', function(done) {
      return expect_no_content_write_access(this.other1, this.project_id, done)
    })

    it('should not allow another user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow another user admin access to it', function(done) {
      return expect_no_admin_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow anonymous user read access to it', function(done) {
      return expect_no_read_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow anonymous user write access to its content', function(done) {
      return expect_no_content_write_access(this.anon, this.project_id, done)
    })

    it('should not allow anonymous user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow anonymous user admin access to it', function(done) {
      return expect_no_admin_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should allow site admin users read access to it', function(done) {
      return expect_read_access(this.site_admin, this.project_id, done)
    })

    it('should allow site admin users write access to its content', function(done) {
      return expect_content_write_access(this.site_admin, this.project_id, done)
    })

    it('should allow site admin users write access to its settings', function(done) {
      return expect_settings_write_access(
        this.site_admin,
        this.project_id,
        done
      )
    })

    it('should allow site admin users admin access to it', function(done) {
      return expect_admin_access(this.site_admin, this.project_id, done)
    })
  })

  describe('shared project', function() {
    beforeEach(function(done) {
      this.rw_user = this.other1
      this.ro_user = this.other2
      return this.owner.createProject(
        'private-project',
        (error, project_id) => {
          if (error != null) {
            return done(error)
          }
          this.project_id = project_id
          return this.owner.addUserToProject(
            this.project_id,
            this.ro_user,
            'readOnly',
            error => {
              if (error != null) {
                return done(error)
              }
              return this.owner.addUserToProject(
                this.project_id,
                this.rw_user,
                'readAndWrite',
                error => {
                  if (error != null) {
                    return done(error)
                  }
                  return done()
                }
              )
            }
          )
        }
      )
    })

    it('should allow the read-only user read access to it', function(done) {
      return expect_read_access(this.ro_user, this.project_id, done)
    })

    it('should not allow the read-only user write access to its content', function(done) {
      return expect_no_content_write_access(this.ro_user, this.project_id, done)
    })

    it('should not allow the read-only user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.ro_user,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow the read-only user admin access to it', function(done) {
      return expect_no_admin_access(
        this.ro_user,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should allow the read-write user read access to it', function(done) {
      return expect_read_access(this.rw_user, this.project_id, done)
    })

    it('should allow the read-write user write access to its content', function(done) {
      return expect_content_write_access(this.rw_user, this.project_id, done)
    })

    it('should allow the read-write user write access to its settings', function(done) {
      return expect_settings_write_access(this.rw_user, this.project_id, done)
    })

    it('should not allow the read-write user admin access to it', function(done) {
      return expect_no_admin_access(
        this.rw_user,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })
  })

  describe('public read-write project', function() {
    beforeEach(function(done) {
      return this.owner.createProject(
        'public-rw-project',
        (error, project_id) => {
          if (error != null) {
            return done(error)
          }
          this.project_id = project_id
          return this.owner.makePublic(this.project_id, 'readAndWrite', done)
        }
      )
    })

    it('should allow a user read access to it', function(done) {
      return expect_read_access(this.other1, this.project_id, done)
    })

    it('should allow a user write access to its content', function(done) {
      return expect_content_write_access(this.other1, this.project_id, done)
    })

    it('should not allow a user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow a user admin access to it', function(done) {
      return expect_no_admin_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should allow an anonymous user read access to it', function(done) {
      return expect_read_access(this.anon, this.project_id, done)
    })

    it('should allow an anonymous user write access to its content', function(done) {
      return expect_content_write_access(this.anon, this.project_id, done)
    })

    it('should not allow an anonymous user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow an anonymous user admin access to it', function(done) {
      return expect_no_admin_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })
  })

  describe('public read-only project', function() {
    beforeEach(function(done) {
      return this.owner.createProject(
        'public-ro-project',
        (error, project_id) => {
          if (error != null) {
            return done(error)
          }
          this.project_id = project_id
          return this.owner.makePublic(this.project_id, 'readOnly', done)
        }
      )
    })

    it('should allow a user read access to it', function(done) {
      return expect_read_access(this.other1, this.project_id, done)
    })

    it('should not allow a user write access to its content', function(done) {
      return expect_no_content_write_access(this.other1, this.project_id, done)
    })

    it('should not allow a user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow a user admin access to it', function(done) {
      return expect_no_admin_access(
        this.other1,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should allow an anonymous user read access to it', function(done) {
      return expect_read_access(this.anon, this.project_id, done)
    })

    it('should not allow an anonymous user write access to its content', function(done) {
      return expect_no_content_write_access(this.anon, this.project_id, done)
    })

    it('should not allow an anonymous user write access to its settings', function(done) {
      return expect_no_settings_write_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })

    it('should not allow an anonymous user admin access to it', function(done) {
      return expect_no_admin_access(
        this.anon,
        this.project_id,
        { redirect_to: '/restricted' },
        done
      )
    })
  })
})
