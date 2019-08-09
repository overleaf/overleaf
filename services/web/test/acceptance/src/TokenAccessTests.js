const { expect } = require('chai')
const async = require('async')
const MockV1Api = require('./helpers/MockV1Api')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const { db, ObjectId } = require('../../../app/src/infrastructure/mongojs')

const tryReadAccess = (user, projectId, test, callback) =>
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

const tryReadOnlyTokenAccess = (user, token, test, callback) =>
  user.request.get(`/read/${token}`, (error, response, body) => {
    if (error != null) {
      return callback(error)
    }
    test(response, body)
    callback()
  })

const tryReadAndWriteTokenAccess = (user, token, test, callback) =>
  user.request.get(`/${token}`, (error, response, body) => {
    if (error != null) {
      return callback(error)
    }
    test(response, body)
    callback()
  })

const tryContentAccess = (user, projcetId, test, callback) => {
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
      url: `/project/${projcetId}/join`,
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

const tryAnonContentAccess = (user, projectId, token, test, callback) => {
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
      headers: {
        'x-sl-anonymous-access-token': token
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

describe('TokenAccess', function() {
  beforeEach(function(done) {
    this.timeout(90000)
    this.owner = new User()
    this.other1 = new User()
    this.other2 = new User()
    this.anon = new User()
    async.parallel(
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
    beforeEach(function(done) {
      this.owner.createProject(
        `token-ro-test${Math.random()}`,
        (err, projectId) => {
          if (err != null) {
            return done(err)
          }
          this.projectId = projectId
          // Note, never made token-based,
          // thus no tokens
          done()
        }
      )
    })

    it('should deny access ', function(done) {
      async.series(
        [
          cb => {
            tryReadAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(body).to.match(/.*\/restricted.*/)
              },
              cb
            )
          },
          cb => {
            tryContentAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal(false)
              },
              cb
            )
          }
        ],
        done
      )
    })
  })

  describe('read-only token', function() {
    beforeEach(function(done) {
      this.owner.createProject(
        `token-ro-test${Math.random()}`,
        (err, projectId) => {
          if (err != null) {
            return done(err)
          }
          this.projectId = projectId
          this.owner.makeTokenBased(this.projectId, err => {
            if (err != null) {
              return done(err)
            }
            this.owner.getProject(this.projectId, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              done()
            })
          })
        }
      )
    })

    it('allow the user read-only access to the project', function(done) {
      async.series(
        [
          cb => {
            // deny access before token is used
            tryReadAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(body).to.match(/.*\/restricted.*/)
              },
              cb
            )
          },
          cb => {
            // use token
            tryReadOnlyTokenAccess(
              this.other1,
              this.tokens.readOnly,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
              },
              cb
            )
          },
          cb => {
            // allow content access read-only
            tryContentAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal('readOnly')
              },
              cb
            )
          }
        ],
        done
      )
    })

    describe('made private again', function() {
      beforeEach(function(done) {
        this.owner.makePrivate(this.projectId, () => setTimeout(done, 1000))
      })

      it('should not allow the user to access the project', function(done) {
        async.series(
          [
            // no access before token is used
            cb =>
              tryReadAccess(
                this.other1,
                this.projectId,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              ),
            cb =>
              tryReadOnlyTokenAccess(
                this.other1,
                this.tokens.readOnly,
                (response, body) => {
                  expect(response.statusCode).to.equal(404)
                },
                cb
              ),
            cb =>
              tryContentAccess(
                this.other1,
                this.projectId,
                (response, body) => {
                  expect(body.privilegeLevel).to.equal(false)
                },
                cb
              )
          ],
          done
        )
      })
    })
  })

  describe('anonymous read-only token', function() {
    beforeEach(function(done) {
      this.owner.createProject(
        `token-anon-ro-test${Math.random()}`,
        (err, projectId) => {
          if (err != null) {
            return done(err)
          }
          this.projectId = projectId
          this.owner.makeTokenBased(this.projectId, err => {
            if (err != null) {
              return done(err)
            }
            this.owner.getProject(this.projectId, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              done()
            })
          })
        }
      )
    })

    it('should allow the user to access project via read-only token url', function(done) {
      async.series(
        [
          cb =>
            tryReadAccess(
              this.anon,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(body).to.match(/.*\/restricted.*/)
              },
              cb
            ),
          cb =>
            tryReadOnlyTokenAccess(
              this.anon,
              this.tokens.readOnly,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
              },
              cb
            ),
          cb =>
            tryAnonContentAccess(
              this.anon,
              this.projectId,
              this.tokens.readOnly,
              (response, body) => {
                expect(body.privilegeLevel).to.equal('readOnly')
              },
              cb
            )
        ],
        done
      )
    })

    describe('made private again', function() {
      beforeEach(function(done) {
        this.owner.makePrivate(this.projectId, () => setTimeout(done, 1000))
      })

      it('should deny access to project', function(done) {
        async.series(
          [
            cb =>
              tryReadAccess(
                this.anon,
                this.projectId,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              ),
            // should not allow the user to access read-only token
            cb =>
              tryReadOnlyTokenAccess(
                this.anon,
                this.tokens.readOnly,
                (response, body) => {
                  expect(response.statusCode).to.equal(404)
                },
                cb
              ),
            // should not allow the user to join the project
            cb =>
              tryAnonContentAccess(
                this.anon,
                this.projectId,
                this.tokens.readOnly,
                (response, body) => {
                  expect(body.privilegeLevel).to.equal(false)
                },
                cb
              )
          ],
          done
        )
      })
    })
  })

  describe('read-and-write token', function() {
    beforeEach(function(done) {
      this.owner.createProject(
        `token-rw-test${Math.random()}`,
        (err, projectId) => {
          if (err != null) {
            return done(err)
          }
          this.projectId = projectId
          this.owner.makeTokenBased(this.projectId, err => {
            if (err != null) {
              return done(err)
            }
            this.owner.getProject(this.projectId, (err, project) => {
              if (err != null) {
                return done(err)
              }
              this.tokens = project.tokens
              done()
            })
          })
        }
      )
    })

    it('should allow the user to access project via read-and-write token url', function(done) {
      async.series(
        [
          // deny access before the token is used
          cb =>
            tryReadAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(response.headers.location).to.match(/\/restricted.*/)
                expect(body).to.match(/.*\/restricted.*/)
              },
              cb
            ),
          cb =>
            tryReadAndWriteTokenAccess(
              this.other1,
              this.tokens.readAndWrite,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
              },
              cb
            ),
          cb =>
            tryContentAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal('readAndWrite')
              },
              cb
            )
        ],
        done
      )
    })

    describe('made private again', function() {
      beforeEach(function(done) {
        this.owner.makePrivate(this.projectId, () => setTimeout(done, 1000))
      })

      it('should deny access to project', function(done) {
        async.series(
          [
            cb => {
              tryReadAccess(
                this.other1,
                this.projectId,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              )
            },
            cb => {
              tryReadAndWriteTokenAccess(
                this.other1,
                this.tokens.readAndWrite,
                (response, body) => {
                  expect(response.statusCode).to.equal(404)
                },
                cb
              )
            },
            cb => {
              tryContentAccess(
                this.other1,
                this.projectId,
                (response, body) => {
                  expect(body.privilegeLevel).to.equal(false)
                },
                cb
              )
            }
          ],
          done
        )
      })
    })
  })

  if (!settings.allowAnonymousReadAndWriteSharing) {
    describe('anonymous read-and-write token, disabled', function() {
      beforeEach(function(done) {
        this.owner.createProject(
          `token-anon-rw-test${Math.random()}`,
          (err, projectId) => {
            if (err != null) {
              return done(err)
            }
            this.projectId = projectId
            this.owner.makeTokenBased(this.projectId, err => {
              if (err != null) {
                return done(err)
              }
              this.owner.getProject(this.projectId, (err, project) => {
                if (err != null) {
                  return done(err)
                }
                this.tokens = project.tokens
                done()
              })
            })
          }
        )
      })

      it('should not allow the user to access read-and-write token', function(done) {
        async.series(
          [
            cb =>
              tryReadAccess(
                this.anon,
                this.projectId,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              ),
            cb =>
              tryReadAndWriteTokenAccess(
                this.anon,
                this.tokens.readAndWrite,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              ),
            cb =>
              tryAnonContentAccess(
                this.anon,
                this.projectId,
                this.tokens.readAndWrite,
                (response, body) => {
                  expect(body.privilegeLevel).to.equal(false)
                },
                cb
              )
          ],
          done
        )
      })
    })
  } else {
    describe('anonymous read-and-write token, enabled', function() {
      beforeEach(function(done) {
        this.owner.createProject(
          `token-anon-rw-test${Math.random()}`,
          (err, projectId) => {
            if (err != null) {
              return done(err)
            }
            this.projectId = projectId
            this.owner.makeTokenBased(this.projectId, err => {
              if (err != null) {
                return done(err)
              }
              this.owner.getProject(this.projectId, (err, project) => {
                if (err != null) {
                  return done(err)
                }
                this.tokens = project.tokens
                done()
              })
            })
          }
        )
      })

      it('should allow the user to access project via read-and-write token url', function(done) {
        async.series(
          [
            cb =>
              tryReadAccess(
                this.anon,
                this.projectId,
                (response, body) => {
                  expect(response.statusCode).to.equal(302)
                  expect(body).to.match(/.*\/restricted.*/)
                },
                cb
              ),
            cb =>
              tryReadAndWriteTokenAccess(
                this.anon,
                this.tokens.readAndWrite,
                (response, body) => {
                  expect(response.statusCode).to.equal(200)
                },
                cb
              ),
            cb =>
              tryAnonContentAccess(
                this.anon,
                this.projectId,
                this.tokens.readAndWrite,
                (response, body) => {
                  expect(body.privilegeLevel).to.equal('readAndWrite')
                },
                cb
              )
          ],
          done
        )
      })

      describe('made private again', function() {
        beforeEach(function(done) {
          this.owner.makePrivate(this.projectId, () => setTimeout(done, 1000))
        })

        it('should not allow the user to access read-and-write token', function(done) {
          async.series(
            [
              cb =>
                tryReadAccess(
                  this.anon,
                  this.projectId,
                  (response, body) => {
                    expect(response.statusCode).to.equal(302)
                    expect(body).to.match(/.*\/restricted.*/)
                  },
                  cb
                ),
              cb =>
                tryReadAndWriteTokenAccess(
                  this.anon,
                  this.tokens.readAndWrite,
                  (response, body) => {
                    expect(response.statusCode).to.equal(404)
                  },
                  cb
                ),
              cb =>
                tryAnonContentAccess(
                  this.anon,
                  this.projectId,
                  this.tokens.readAndWrite,
                  (response, body) => {
                    expect(body.privilegeLevel).to.equal(false)
                  },
                  cb
                )
            ],
            done
          )
        })
      })
    })
  }

  describe('private overleaf project', function() {
    beforeEach(function(done) {
      this.owner.createProject('overleaf-import', (err, projectId) => {
        expect(err).not.to.exist
        this.projectId = projectId
        this.owner.makeTokenBased(this.projectId, err => {
          expect(err).not.to.exist
          this.owner.getProject(this.projectId, (err, project) => {
            expect(err).not.to.exist
            this.tokens = project.tokens
            this.owner.makePrivate(this.projectId, () => {
              db.projects.update(
                { _id: project._id },
                {
                  $set: {
                    overleaf: { id: 1234 }
                  }
                },
                err => {
                  expect(err).not.to.exist
                  done()
                }
              )
            })
          })
        })
      })
    })

    it('should only allow the owner access to the project', function(done) {
      async.series(
        [
          // should redirect to canonical path, when owner uses read-write token
          cb =>
            tryReadAndWriteTokenAccess(
              this.owner,
              this.tokens.readAndWrite,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(response.headers.location).to.equal(
                  `/project/${this.projectId}`
                )
              },
              cb
            ),
          cb =>
            tryReadAccess(
              this.owner,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
              },
              cb
            ),
          cb =>
            tryContentAccess(
              this.owner,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal('owner')
              },
              cb
            ),
          // non-owner should be denied access
          cb =>
            tryContentAccess(
              this.other2,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal(false)
              },
              cb
            )
        ],
        done
      )
    })
  })

  describe('private project, with higher access', function() {
    beforeEach(function(done) {
      this.owner.createProject(
        `higher-access-test-${Math.random()}`,
        (err, projectId) => {
          expect(err).not.to.exist
          this.projectId = projectId
          this.owner.addUserToProject(
            this.projectId,
            this.other1,
            'readAndWrite',
            err => {
              expect(err).not.to.exist
              this.owner.makeTokenBased(this.projectId, err => {
                expect(err).not.to.exist
                this.owner.getProject(this.projectId, (err, project) => {
                  expect(err).not.to.exist
                  this.tokens = project.tokens
                  this.owner.makePrivate(this.projectId, () => {
                    setTimeout(done, 1000)
                  })
                })
              })
            }
          )
        }
      )
    })

    it('should allow the user access to the project', function(done) {
      async.series(
        [
          // should redirect to canonical path, when user uses read-write token
          cb =>
            tryReadAndWriteTokenAccess(
              this.other1,
              this.tokens.readAndWrite,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(response.headers.location).to.equal(
                  `/project/${this.projectId}`
                )
              },
              cb
            ),
          // should redirect to canonical path, when user uses read-only token
          cb =>
            tryReadOnlyTokenAccess(
              this.other1,
              this.tokens.readOnly,
              (response, body) => {
                expect(response.statusCode).to.equal(302)
                expect(response.headers.location).to.equal(
                  `/project/${this.projectId}`
                )
              },
              cb
            ),
          // should allow the user access to the project
          cb =>
            tryReadAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
              },
              cb
            ),
          // should allow user to join the project
          cb =>
            tryContentAccess(
              this.other1,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal('readAndWrite')
              },
              cb
            ),
          // should not allow a different user to join the project
          cb =>
            tryContentAccess(
              this.other2,
              this.projectId,
              (response, body) => {
                expect(body.privilegeLevel).to.equal(false)
              },
              cb
            )
        ],
        done
      )
    })
  })

  describe('unimported v1 project', function() {
    beforeEach(function() {
      settings.overleaf = { host: 'http://localhost:5000' }
    })

    afterEach(function() {
      delete settings.overleaf
    })

    it('should show error page for read and write token', function(done) {
      const unimportedV1Token = '123abc'
      tryReadAndWriteTokenAccess(
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
      tryReadOnlyTokenAccess(
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
    beforeEach(function(done) {
      settings.projectImportingCheckMaxCreateDelta = 3600
      settings.overleaf = { host: 'http://localhost:5000' }
      this.owner.createProject(
        `token-rw-test${Math.random()}`,
        (err, projectId) => {
          if (err != null) {
            return done(err)
          }
          this.projectId = projectId
          this.owner.makeTokenBased(this.projectId, err => {
            if (err != null) {
              return done(err)
            }
            db.projects.update(
              { _id: ObjectId(projectId) },
              { $set: { overleaf: { id: 1234 } } },
              err => {
                if (err != null) {
                  return done(err)
                }
                this.owner.getProject(this.projectId, (err, project) => {
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
                  done()
                })
              }
            )
          })
        }
      )
    })

    afterEach(function() {
      delete settings.projectImportingCheckMaxCreateDelta
      delete settings.overleaf
    })

    it('should show importing page for read, and read-write tokens', function(done) {
      async.series(
        [
          cb =>
            tryReadAndWriteTokenAccess(
              this.owner,
              this.tokens.readAndWrite,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body).to.include('ImportingController')
              },
              cb
            ),
          cb =>
            tryReadOnlyTokenAccess(
              this.owner,
              this.tokens.readOnly,
              (response, body) => {
                expect(response.statusCode).to.equal(200)
                expect(body).to.include('ImportingController')
              },
              cb
            )
        ],
        done
      )
    })

    describe('when importing check not configured', function() {
      beforeEach(function() {
        delete settings.projectImportingCheckMaxCreateDelta
      })

      it('should load editor', function(done) {
        tryReadAndWriteTokenAccess(
          this.owner,
          this.tokens.readAndWrite,
          (response, body) => {
            expect(response.statusCode).to.equal(200)
            expect(body).to.include('IdeController')
          },
          done
        )
      })
    })
  })
})
