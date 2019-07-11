/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
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
const MockV1Api = require('./helpers/MockV1Api')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')

const try_read_access = (user, project_id, test, callback) =>
  async.series(
    [
      cb =>
        user.request.get(`/project/${project_id}`, function(
          error,
          response,
          body
        ) {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          return cb()
        }),
      cb =>
        user.request.get(`/project/${project_id}/download/zip`, function(
          error,
          response,
          body
        ) {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          return cb()
        })
    ],
    callback
  )

const try_read_only_token_access = (user, token, test, callback) =>
  async.series(
    [
      cb =>
        user.request.get(`/read/${token}`, function(error, response, body) {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          return cb()
        })
    ],
    callback
  )

const try_read_and_write_token_access = (user, token, test, callback) =>
  async.series(
    [
      cb =>
        user.request.get(`/${token}`, function(error, response, body) {
          if (error != null) {
            return cb(error)
          }
          test(response, body)
          return cb()
        })
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
    function(error, response, body) {
      if (error != null) {
        return callback(error)
      }
      test(response, body)
      return callback()
    }
  )
}

const try_anon_content_access = function(
  user,
  project_id,
  token,
  test,
  callback
) {
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
      headers: {
        'x-sl-anonymous-access-token': token
      },
      json: true,
      jar: false
    },
    function(error, response, body) {
      if (error != null) {
        return callback(error)
      }
      test(response, body)
      return callback()
    }
  )
}

describe('TokenAccess', function() {
  before(function(done) {
    this.timeout(90000)
    this.owner = new User()
    this.other1 = new User()
    this.other2 = new User()
    this.anon = new User()
    return async.parallel(
      [
        cb => this.owner.login(cb),
        cb => this.other1.login(cb),
        cb => this.other2.login(cb),
        cb => this.anon.getCsrfToken(cb)
      ],
      done
    )
  })

  describe('no token-access', function() {
    before(function(done) {
      return this.owner.createProject(
        `token-ro-test${Math.random()}`,
        (err, project_id) => {
          if (err != null) {
            return done(err)
          }
          this.project_id = project_id
          // Note, never made token-based,
          // thus no tokens
          return done()
        }
      )
    })

    it('should deny access ', function(done) {
      return try_read_access(
        this.other1,
        this.project_id,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(body).to.match(/.*\/restricted.*/)
        },
        done
      )
    })

    it('should not allow the user to join the project', function(done) {
      return try_content_access(
        this.other1,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal(false)
        },
        done
      )
    })
  })

  describe('read-only token', function() {
    before(function(done) {
      return this.owner.createProject(
        `token-ro-test${Math.random()}`,
        (err, project_id) => {
          if (err != null) {
            return done(err)
          }
          this.project_id = project_id
          return this.owner.makeTokenBased(this.project_id, err => {
            if (err != null) {
              return done(err)
            }
            return this.owner.getProject(this.project_id, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              return done()
            })
          })
        }
      )
    })

    it('should deny access before the token is used', function(done) {
      return try_read_access(
        this.other1,
        this.project_id,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(body).to.match(/.*\/restricted.*/)
        },
        done
      )
    })

    it('should allow the user to access project via read-only token url', function(done) {
      return try_read_only_token_access(
        this.other1,
        this.tokens.readOnly,
        (response, body) => {
          return expect(response.statusCode).to.equal(200)
        },
        done
      )
    })

    it('should allow the user to join the project with read-only access', function(done) {
      return try_content_access(
        this.other1,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal('readOnly')
        },
        done
      )
    })

    describe('made private again', function() {
      before(function(done) {
        return this.owner.makePrivate(this.project_id, () =>
          setTimeout(done, 1000)
        )
      })

      it('should deny access to project', function(done) {
        return try_read_access(
          this.other1,
          this.project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should not allow the user to access read-only token', function(done) {
        return try_read_only_token_access(
          this.other1,
          this.tokens.readOnly,
          (response, body) => {
            return expect(response.statusCode).to.equal(404)
          },
          done
        )
      })

      it('should not allow the user to join the project', function(done) {
        return try_content_access(
          this.other1,
          this.project_id,
          (response, body) => {
            return expect(body.privilegeLevel).to.equal(false)
          },
          done
        )
      })
    })
  })

  describe('anonymous read-only token', function() {
    before(function(done) {
      return this.owner.createProject(
        `token-anon-ro-test${Math.random()}`,
        (err, project_id) => {
          if (err != null) {
            return done(err)
          }
          this.project_id = project_id
          return this.owner.makeTokenBased(this.project_id, err => {
            if (err != null) {
              return done(err)
            }
            return this.owner.getProject(this.project_id, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              return done()
            })
          })
        }
      )
    })

    it('should deny access before the token is used', function(done) {
      return try_read_access(
        this.anon,
        this.project_id,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(body).to.match(/.*\/restricted.*/)
        },
        done
      )
    })

    it('should allow the user to access project via read-only token url', function(done) {
      return try_read_only_token_access(
        this.anon,
        this.tokens.readOnly,
        (response, body) => {
          return expect(response.statusCode).to.equal(200)
        },
        done
      )
    })

    it('should allow the user to anonymously join the project with read-only access', function(done) {
      return try_anon_content_access(
        this.anon,
        this.project_id,
        this.tokens.readOnly,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal('readOnly')
        },
        done
      )
    })

    describe('made private again', function() {
      before(function(done) {
        return this.owner.makePrivate(this.project_id, () =>
          setTimeout(done, 1000)
        )
      })

      it('should deny access to project', function(done) {
        return try_read_access(
          this.anon,
          this.project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should not allow the user to access read-only token', function(done) {
        return try_read_only_token_access(
          this.anon,
          this.tokens.readOnly,
          (response, body) => {
            return expect(response.statusCode).to.equal(404)
          },
          done
        )
      })

      it('should not allow the user to join the project', function(done) {
        return try_anon_content_access(
          this.anon,
          this.project_id,
          this.tokens.readOnly,
          (response, body) => {
            return expect(body.privilegeLevel).to.equal(false)
          },
          done
        )
      })
    })
  })

  describe('read-and-write token', function() {
    before(function(done) {
      return this.owner.createProject(
        `token-rw-test${Math.random()}`,
        (err, project_id) => {
          if (err != null) {
            return done(err)
          }
          this.project_id = project_id
          return this.owner.makeTokenBased(this.project_id, err => {
            if (err != null) {
              return done(err)
            }
            return this.owner.getProject(this.project_id, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              return done()
            })
          })
        }
      )
    })

    it('should deny access before the token is used', function(done) {
      return try_read_access(
        this.other1,
        this.project_id,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          expect(response.headers.location).to.match(/\/restricted.*/)
          return expect(body).to.match(/.*\/restricted.*/)
        },
        done
      )
    })

    it('should allow the user to access project via read-and-write token url', function(done) {
      return try_read_and_write_token_access(
        this.other1,
        this.tokens.readAndWrite,
        (response, body) => {
          return expect(response.statusCode).to.equal(200)
        },
        done
      )
    })

    it('should allow the user to join the project with read-and-write access', function(done) {
      return try_content_access(
        this.other1,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal('readAndWrite')
        },
        done
      )
    })

    describe('made private again', function() {
      before(function(done) {
        return this.owner.makePrivate(this.project_id, () =>
          setTimeout(done, 1000)
        )
      })

      it('should deny access to project', function(done) {
        return try_read_access(
          this.other1,
          this.project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should not allow the user to access read-and-write token', function(done) {
        return try_read_and_write_token_access(
          this.other1,
          this.tokens.readAndWrite,
          (response, body) => {
            return expect(response.statusCode).to.equal(404)
          },
          done
        )
      })

      it('should not allow the user to join the project', function(done) {
        return try_content_access(
          this.other1,
          this.project_id,
          (response, body) => {
            return expect(body.privilegeLevel).to.equal(false)
          },
          done
        )
      })
    })
  })

  if (!settings.allowAnonymousReadAndWriteSharing) {
    describe('anonymous read-and-write token, disabled', function() {
      before(function(done) {
        return this.owner.createProject(
          `token-anon-rw-test${Math.random()}`,
          (err, project_id) => {
            if (err != null) {
              return done(err)
            }
            this.project_id = project_id
            return this.owner.makeTokenBased(this.project_id, err => {
              if (err != null) {
                return done(err)
              }
              return this.owner.getProject(this.project_id, (err, project) => {
                if (err != null) {
                  return done(err)
                }
                this.tokens = project.tokens
                return done()
              })
            })
          }
        )
      })

      it('should deny access before the token is used', function(done) {
        return try_read_access(
          this.anon,
          this.project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should not allow the user to access read-and-write token', function(done) {
        return try_read_and_write_token_access(
          this.anon,
          this.tokens.readAndWrite,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should not allow the user to join the project', function(done) {
        return try_anon_content_access(
          this.anon,
          this.project_id,
          this.tokens.readAndWrite,
          (response, body) => {
            return expect(body.privilegeLevel).to.equal(false)
          },
          done
        )
      })
    })
  } else {
    describe('anonymous read-and-write token, enabled', function() {
      before(function(done) {
        return this.owner.createProject(
          `token-anon-rw-test${Math.random()}`,
          (err, project_id) => {
            if (err != null) {
              return done(err)
            }
            this.project_id = project_id
            return this.owner.makeTokenBased(this.project_id, err => {
              if (err != null) {
                return done(err)
              }
              return this.owner.getProject(this.project_id, (err, project) => {
                if (err != null) {
                  return done(err)
                }
                this.tokens = project.tokens
                return done()
              })
            })
          }
        )
      })

      it('should deny access before the token is used', function(done) {
        return try_read_access(
          this.anon,
          this.project_id,
          (response, body) => {
            expect(response.statusCode).to.equal(302)
            return expect(body).to.match(/.*\/restricted.*/)
          },
          done
        )
      })

      it('should allow the user to access project via read-and-write token url', function(done) {
        return try_read_and_write_token_access(
          this.anon,
          this.tokens.readAndWrite,
          (response, body) => {
            return expect(response.statusCode).to.equal(200)
          },
          done
        )
      })

      it('should allow the user to anonymously join the project with read-and-write access', function(done) {
        return try_anon_content_access(
          this.anon,
          this.project_id,
          this.tokens.readAndWrite,
          (response, body) => {
            return expect(body.privilegeLevel).to.equal('readAndWrite')
          },
          done
        )
      })

      describe('made private again', function() {
        before(function(done) {
          return this.owner.makePrivate(this.project_id, () =>
            setTimeout(done, 1000)
          )
        })

        it('should deny access to project', function(done) {
          return try_read_access(
            this.anon,
            this.project_id,
            (response, body) => {
              expect(response.statusCode).to.equal(302)
              return expect(body).to.match(/.*\/restricted.*/)
            },
            done
          )
        })

        it('should not allow the user to access read-and-write token', function(done) {
          return try_read_and_write_token_access(
            this.anon,
            this.tokens.readAndWrite,
            (response, body) => {
              return expect(response.statusCode).to.equal(404)
            },
            done
          )
        })

        it('should not allow the user to join the project', function(done) {
          return try_anon_content_access(
            this.anon,
            this.project_id,
            this.tokens.readAndWrite,
            (response, body) => {
              return expect(body.privilegeLevel).to.equal(false)
            },
            done
          )
        })
      })
    })
  }

  describe('private overleaf project', function() {
    before(function(done) {
      return this.owner.createProject('overleaf-import', (err, project_id) => {
        this.project_id = project_id
        return this.owner.makeTokenBased(this.project_id, err => {
          return this.owner.getProject(this.project_id, (err, project) => {
            this.tokens = project.tokens
            return this.owner.makePrivate(this.project_id, () => {
              return db.projects.update(
                { _id: project._id },
                {
                  $set: {
                    overleaf: { id: 1234 }
                  }
                },
                err => {
                  return done()
                }
              )
            })
          })
        })
      })
    })

    it('should redirect to canonical path, when owner uses read-write token', function(done) {
      return try_read_and_write_token_access(
        this.owner,
        this.tokens.readAndWrite,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(response.headers.location).to.equal(
            `/project/${this.project_id}`
          )
        },
        done
      )
    })

    it('should allow the owner access to the project', function(done) {
      return try_read_access(
        this.owner,
        this.project_id,
        (response, body) => {
          return expect(response.statusCode).to.equal(200)
        },
        done
      )
    })

    it('should allow owner to join the project', function(done) {
      return try_content_access(
        this.owner,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal('owner')
        },
        done
      )
    })

    it('should not allow other user to join the project', function(done) {
      return try_content_access(
        this.other2,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal(false)
        },
        done
      )
    })
  })

  describe('private project, with higher access', function() {
    before(function(done) {
      return this.owner.createProject(
        `higher-access-test-${Math.random()}`,
        (err, project_id) => {
          this.project_id = project_id
          return this.owner.addUserToProject(
            this.project_id,
            this.other1,
            'readAndWrite',
            err => {
              return this.owner.makeTokenBased(this.project_id, err => {
                return this.owner.getProject(
                  this.project_id,
                  (err, project) => {
                    this.tokens = project.tokens
                    return this.owner.makePrivate(this.project_id, () => {
                      return setTimeout(done, 1000)
                    })
                  }
                )
              })
            }
          )
        }
      )
    })

    it('should redirect to canonical path, when user uses read-write token', function(done) {
      return try_read_and_write_token_access(
        this.other1,
        this.tokens.readAndWrite,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(response.headers.location).to.equal(
            `/project/${this.project_id}`
          )
        },
        done
      )
    })

    it('should redirect to canonical path, when user uses read-only token', function(done) {
      return try_read_only_token_access(
        this.other1,
        this.tokens.readOnly,
        (response, body) => {
          expect(response.statusCode).to.equal(302)
          return expect(response.headers.location).to.equal(
            `/project/${this.project_id}`
          )
        },
        done
      )
    })

    it('should allow the user access to the project', function(done) {
      return try_read_access(
        this.other1,
        this.project_id,
        (response, body) => {
          return expect(response.statusCode).to.equal(200)
        },
        done
      )
    })

    it('should allow user to join the project', function(done) {
      return try_content_access(
        this.other1,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal('readAndWrite')
        },
        done
      )
    })

    it('should not allow a different user to join the project', function(done) {
      return try_content_access(
        this.other2,
        this.project_id,
        (response, body) => {
          return expect(body.privilegeLevel).to.equal(false)
        },
        done
      )
    })
  })

  describe('unimported v1 project', function() {
    before(() => (settings.overleaf = { host: 'http://localhost:5000' }))

    after(() => delete settings.overleaf)

    it('should show error page for read and write token', function(done) {
      const unimportedV1Token = '123abc'
      try_read_and_write_token_access(
        this.owner,
        unimportedV1Token,
        (response, body) => {
          expect(response.statusCode).to.equal(400)
        },
        done
      )
    })

    it('should show error page for read only token to v1', function(done) {
      const unimportedV1Token = 'abcd'
      try_read_only_token_access(
        this.owner,
        unimportedV1Token,
        (response, body) => {
          expect(response.statusCode).to.equal(400)
        },
        done
      )
    })
  })

  describe('importing v1 project', function() {
    before(function(done) {
      settings.projectImportingCheckMaxCreateDelta = 3600
      settings.overleaf = { host: 'http://localhost:5000' }
      return this.owner.createProject(
        `token-rw-test${Math.random()}`,
        (err, project_id) => {
          if (err != null) {
            return done(err)
          }
          this.project_id = project_id
          return this.owner.makeTokenBased(this.project_id, err => {
            if (err != null) {
              return done(err)
            }
            return db.projects.update(
              { _id: ObjectId(project_id) },
              { $set: { overleaf: { id: 1234 } } },
              err => {
                if (err != null) {
                  return done(err)
                }
                return this.owner.getProject(
                  this.project_id,
                  (err, project) => {
                    if (err != null) {
                      return done(err)
                    }
                    this.tokens = project.tokens
                    MockV1Api.setDocExported(this.tokens.readAndWrite, {
                      exporting: true
                    })
                    MockV1Api.setDocExported(this.tokens.readOnly, {
                      exporting: true
                    })
                    return done()
                  }
                )
              }
            )
          })
        }
      )
    })

    after(function() {
      delete settings.projectImportingCheckMaxCreateDelta
      return delete settings.overleaf
    })

    it('should show importing page for read and write token', function(done) {
      return try_read_and_write_token_access(
        this.owner,
        this.tokens.readAndWrite,
        (response, body) => {
          expect(response.statusCode).to.equal(200)
          return expect(body).to.include('ImportingController')
        },
        done
      )
    })

    it('should show importing page for read only token', function(done) {
      return try_read_only_token_access(
        this.owner,
        this.tokens.readOnly,
        (response, body) => {
          expect(response.statusCode).to.equal(200)
          return expect(body).to.include('ImportingController')
        },
        done
      )
    })

    describe('when importing check not configured', function() {
      before(() => delete settings.projectImportingCheckMaxCreateDelta)

      it('should load editor', function(done) {
        return try_read_and_write_token_access(
          this.owner,
          this.tokens.readAndWrite,
          (response, body) => {
            expect(response.statusCode).to.equal(200)
            return expect(body).to.include('IdeController')
          },
          done
        )
      })
    })
  })
})
