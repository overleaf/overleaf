/* eslint-disable
    handle-callback-err,
    max-len,
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
const Async = require('async')
const User = require('./helpers/User')
const request = require('./helpers/request')
const settings = require('settings-sharelatex')
const CollaboratorsEmailHandler = require('../../../app/src/Features/Collaborators/CollaboratorsEmailHandler')

const createInvite = function(sendingUser, projectId, email, callback) {
  if (callback == null) {
    callback = function(err, invite) {}
  }
  return sendingUser.getCsrfToken(function(err) {
    if (err) {
      return callback(err)
    }
    return sendingUser.request.post(
      {
        uri: `/project/${projectId}/invite`,
        json: {
          email,
          privileges: 'readAndWrite'
        }
      },
      function(err, response, body) {
        if (err) {
          return callback(err)
        }
        expect(response.statusCode).to.equal(200)
        return callback(null, body.invite)
      }
    )
  })
}

const createProject = function(owner, projectName, callback) {
  if (callback == null) {
    callback = function(err, projectId, project) {}
  }
  return owner.createProject(projectName, function(err, projectId) {
    if (err) {
      throw err
    }
    const fakeProject = {
      _id: projectId,
      name: projectName,
      owner_ref: owner
    }
    return callback(err, projectId, fakeProject)
  })
}

const createProjectAndInvite = function(owner, projectName, email, callback) {
  if (callback == null) {
    callback = function(err, project, invite) {}
  }
  return createProject(owner, projectName, function(err, projectId, project) {
    if (err) {
      return callback(err)
    }
    return createInvite(owner, projectId, email, function(err, invite) {
      if (err) {
        return callback(err)
      }
      const link = CollaboratorsEmailHandler._buildInviteUrl(project, invite)
      return callback(null, project, invite, link)
    })
  })
}

const revokeInvite = function(sendingUser, projectId, inviteId, callback) {
  if (callback == null) {
    callback = function(err) {}
  }
  return sendingUser.getCsrfToken(function(err) {
    if (err) {
      return callback(err)
    }
    return sendingUser.request.delete(
      {
        uri: `/project/${projectId}/invite/${inviteId}`
      },
      function(err, response, body) {
        if (err) {
          return callback(err)
        }
        return callback(null)
      }
    )
  })
}

// Actions
const tryFollowInviteLink = function(user, link, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.request.get(
    {
      uri: link,
      baseUrl: null
    },
    callback
  )
}

const tryAcceptInvite = function(user, invite, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.request.post(
    {
      uri: `/project/${invite.projectId}/invite/token/${invite.token}/accept`,
      json: {
        token: invite.token
      }
    },
    callback
  )
}

const tryRegisterUser = function(user, email, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(error => {
    if (error != null) {
      return callback(error)
    }
    return user.request.post(
      {
        url: '/register',
        json: {
          email,
          password: 'some_weird_password'
        }
      },
      callback
    )
  })
}

const tryFollowLoginLink = function(user, loginLink, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(error => {
    if (error != null) {
      return callback(error)
    }
    return user.request.get(loginLink, callback)
  })
}

const tryLoginUser = function(user, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(error => {
    if (error != null) {
      return callback(error)
    }
    return user.request.post(
      {
        url: '/login',
        json: {
          email: user.email,
          password: user.password
        }
      },
      callback
    )
  })
}

const tryGetInviteList = function(user, projectId, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(error => {
    if (error != null) {
      return callback(error)
    }
    return user.request.get(
      {
        url: `/project/${projectId}/invites`,
        json: true
      },
      callback
    )
  })
}

const tryJoinProject = function(user, projectId, callback) {
  if (callback == null) {
    callback = function(err, response, body) {}
  }
  return user.getCsrfToken(error => {
    if (error != null) {
      return callback(error)
    }
    return user.request.post(
      {
        url: `/project/${projectId}/join`,
        qs: { user_id: user._id },
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true
        },
        json: true,
        jar: false
      },
      callback
    )
  })
}

// Expectations
const expectProjectAccess = function(user, projectId, callback) {
  // should have access to project
  if (callback == null) {
    callback = function(err, result) {}
  }
  return user.openProject(projectId, err => {
    expect(err).to.be.oneOf([null, undefined])
    return callback()
  })
}

const expectNoProjectAccess = function(user, projectId, callback) {
  // should not have access to project page
  if (callback == null) {
    callback = function(err, result) {}
  }
  return user.openProject(projectId, err => {
    expect(err).to.be.instanceof(Error)
    return callback()
  })
}

const expectInvitePage = function(user, link, callback) {
  // view invite
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryFollowInviteLink(user, link, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    expect(body).to.match(new RegExp('<title>Project Invite - .*</title>'))
    return callback()
  })
}

const expectInvalidInvitePage = function(user, link, callback) {
  // view invalid invite
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryFollowInviteLink(user, link, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    expect(body).to.match(new RegExp('<title>Invalid Invite - .*</title>'))
    return callback()
  })
}

const expectInviteRedirectToRegister = function(user, link, callback) {
  // view invite, redirect to `/register`
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryFollowInviteLink(user, link, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(302)
    expect(response.headers.location).to.match(new RegExp('^/register.*$'))
    // follow redirect to register page and extract the redirectUrl from form
    return user.request.get(response.headers.location, (err, response, body) =>
      callback(null)
    )
  })
}

const expectLoginPage = function(user, callback) {
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryFollowLoginLink(user, '/login', function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    expect(body).to.match(new RegExp('<title>Login - .*</title>'))
    return callback(null)
  })
}

const expectLoginRedirectToInvite = function(user, link, callback) {
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryLoginUser(user, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    return callback(null, null)
  })
}

const expectRegistrationRedirectToInvite = function(
  user,
  email,
  link,
  callback
) {
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryRegisterUser(user, email, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    return callback(null, null)
  })
}

const expectInviteRedirectToProject = function(user, link, invite, callback) {
  // view invite, redirect straight to project
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryFollowInviteLink(user, link, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(302)
    expect(response.headers.location).to.equal(`/project/${invite.projectId}`)
    return callback()
  })
}

const expectAcceptInviteAndRedirect = function(user, invite, callback) {
  // should accept the invite and redirect to project
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryAcceptInvite(user, invite, (err, response, body) => {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(302)
    expect(response.headers.location).to.equal(`/project/${invite.projectId}`)
    return callback()
  })
}

const expectInviteListCount = function(user, projectId, count, callback) {
  if (callback == null) {
    callback = function(err) {}
  }
  return tryGetInviteList(user, projectId, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    expect(body).to.have.all.keys(['invites'])
    expect(body.invites.length).to.equal(count)
    return callback()
  })
}

const expectInvitesInJoinProjectCount = function(
  user,
  projectId,
  count,
  callback
) {
  if (callback == null) {
    callback = function(err, result) {}
  }
  return tryJoinProject(user, projectId, function(err, response, body) {
    expect(err).to.be.oneOf([null, undefined])
    expect(response.statusCode).to.equal(200)
    expect(body.project).to.contain.keys(['invites'])
    expect(body.project.invites.length).to.equal(count)
    return callback()
  })
}

describe('ProjectInviteTests', function() {
  before(function(done) {
    this.sendingUser = new User()
    this.user = new User()
    this.site_admin = new User({ email: 'admin@example.com' })
    this.email = 'smoketestuser@example.com'
    this.projectName = 'sharing test'
    return Async.series(
      [
        cb => this.user.ensureUserExists(cb),
        cb => this.sendingUser.login(cb),
        cb => this.sendingUser.setFeatures({ collaborators: 10 }, cb)
      ],
      done
    )
  })

  describe('creating invites', function() {
    beforeEach(function(done) {
      this.projectName = 'wat'
      this.projectId = null
      this.fakeProject = null
      return done()
    })

    return describe('creating two invites', function() {
      beforeEach(function(done) {
        return Async.series(
          [
            cb => {
              return createProject(
                this.sendingUser,
                this.projectName,
                (err, projectId, project) => {
                  this.projectId = projectId
                  this.fakeProject = project
                  return cb()
                }
              )
            }
          ],
          done
        )
      })

      afterEach(function(done) {
        return Async.series(
          [
            cb => this.sendingUser.deleteProject(this.projectId, cb),
            cb => this.sendingUser.deleteProject(this.projectId, cb)
          ],
          done
        )
      })

      it('should allow the project owner to create and remove invites', function(done) {
        this.invite = null
        return Async.series(
          [
            cb => expectProjectAccess(this.sendingUser, this.projectId, cb),
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 0, cb),
            // create invite, check invite list count
            cb => {
              return createInvite(
                this.sendingUser,
                this.projectId,
                this.email,
                (err, invite) => {
                  if (err) {
                    return cb(err)
                  }
                  this.invite = invite
                  return cb()
                }
              )
            },
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 1, cb),
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.invite._id,
                cb
              ),
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 0, cb),
            // and a second time
            cb => {
              return createInvite(
                this.sendingUser,
                this.projectId,
                this.email,
                (err, invite) => {
                  if (err) {
                    return cb(err)
                  }
                  this.invite = invite
                  return cb()
                }
              )
            },
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 1, cb),
            // check the joinProject view
            cb =>
              expectInvitesInJoinProjectCount(
                this.sendingUser,
                this.projectId,
                1,
                cb
              ),
            // revoke invite
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.invite._id,
                cb
              ),
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 0, cb),
            cb =>
              expectInvitesInJoinProjectCount(
                this.sendingUser,
                this.projectId,
                0,
                cb
              )
          ],
          done
        )
      })

      return it('should allow the project owner to create many invites at once', function(done) {
        this.inviteOne = null
        this.inviteTwo = null
        return Async.series(
          [
            cb => expectProjectAccess(this.sendingUser, this.projectId, cb),
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 0, cb),
            // create first invite
            cb => {
              return createInvite(
                this.sendingUser,
                this.projectId,
                this.email,
                (err, invite) => {
                  if (err) {
                    return cb(err)
                  }
                  this.inviteOne = invite
                  return cb()
                }
              )
            },
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 1, cb),
            // and a second
            cb => {
              return createInvite(
                this.sendingUser,
                this.projectId,
                this.email,
                (err, invite) => {
                  if (err) {
                    return cb(err)
                  }
                  this.inviteTwo = invite
                  return cb()
                }
              )
            },
            // should have two
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 2, cb),
            cb =>
              expectInvitesInJoinProjectCount(
                this.sendingUser,
                this.projectId,
                2,
                cb
              ),
            // revoke first
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.inviteOne._id,
                cb
              ),
            cb =>
              expectInviteListCount(this.sendingUser, this.projectId, 1, cb),
            // revoke second
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.inviteTwo._id,
                cb
              ),
            cb => expectInviteListCount(this.sendingUser, this.projectId, 0, cb)
          ],
          done
        )
      })
    })
  })

  return describe('clicking the invite link', function() {
    beforeEach(function(done) {
      this.projectId = null
      this.fakeProject = null
      return done()
    })

    describe('user is logged in already', function() {
      beforeEach(function(done) {
        return Async.series(
          [
            cb => {
              return createProjectAndInvite(
                this.sendingUser,
                this.projectName,
                this.email,
                (err, project, invite, link) => {
                  this.projectId = project._id
                  this.fakeProject = project
                  this.invite = invite
                  this.link = link
                  return cb()
                }
              )
            },
            cb => {
              return this.user.login(err => {
                if (err) {
                  throw err
                }
                return cb()
              })
            }
          ],
          done
        )
      })

      afterEach(function(done) {
        return Async.series(
          [
            cb => this.sendingUser.deleteProject(this.projectId, cb),
            cb => this.sendingUser.deleteProject(this.projectId, cb),
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.invite._id,
                cb
              )
          ],
          done
        )
      })

      describe('user is already a member of the project', function() {
        beforeEach(function(done) {
          return Async.series(
            [
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectAcceptInviteAndRedirect(this.user, this.invite, cb),
              cb => expectProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        return describe('when user clicks on the invite a second time', function() {
          it('should just redirect to the project page', function(done) {
            return Async.series(
              [
                cb => expectProjectAccess(this.user, this.invite.projectId, cb),
                cb =>
                  expectInviteRedirectToProject(
                    this.user,
                    this.link,
                    this.invite,
                    cb
                  ),
                cb => expectProjectAccess(this.user, this.invite.projectId, cb)
              ],
              done
            )
          })

          return describe('when the user recieves another invite to the same project', () =>
            it('should redirect to the project page', function(done) {
              return Async.series(
                [
                  cb => {
                    return createInvite(
                      this.sendingUser,
                      this.projectId,
                      this.email,
                      (err, invite) => {
                        if (err) {
                          throw err
                        }
                        this.secondInvite = invite
                        this.secondLink = CollaboratorsEmailHandler._buildInviteUrl(
                          this.fakeProject,
                          invite
                        )
                        return cb()
                      }
                    )
                  },
                  cb =>
                    expectInviteRedirectToProject(
                      this.user,
                      this.secondLink,
                      this.secondInvite,
                      cb
                    ),
                  cb =>
                    expectProjectAccess(this.user, this.invite.projectId, cb),
                  cb =>
                    revokeInvite(
                      this.sendingUser,
                      this.projectId,
                      this.secondInvite._id,
                      cb
                    )
                ],
                done
              )
            }))
        })
      })

      return describe('user is not a member of the project', function() {
        it('should not grant access if the user does not accept the invite', function(done) {
          return Async.series(
            [
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        it('should render the invalid-invite page if the token is invalid', function(done) {
          return Async.series(
            [
              cb => {
                const link = this.link.replace(
                  this.invite.token,
                  'not_a_real_token'
                )
                return expectInvalidInvitePage(this.user, link, cb)
              },
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        return it('should allow the user to accept the invite and access the project', function(done) {
          return Async.series(
            [
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectAcceptInviteAndRedirect(this.user, this.invite, cb),
              cb => expectProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })
      })
    })

    return describe('user is not logged in initially', function() {
      before(function(done) {
        return this.user.logout(done)
      })

      beforeEach(function(done) {
        return Async.series(
          [
            cb => {
              return createProjectAndInvite(
                this.sendingUser,
                this.projectName,
                this.email,
                (err, project, invite, link) => {
                  this.projectId = project._id
                  this.fakeProject = project
                  this.invite = invite
                  this.link = link
                  return cb()
                }
              )
            }
          ],
          done
        )
      })

      afterEach(function(done) {
        return Async.series(
          [
            cb => this.sendingUser.deleteProject(this.projectId, cb),
            cb => this.sendingUser.deleteProject(this.projectId, cb),
            cb =>
              revokeInvite(
                this.sendingUser,
                this.projectId,
                this.invite._id,
                cb
              )
          ],
          done
        )
      })

      describe('registration prompt workflow with valid token', function() {
        it('should redirect to the register page', function(done) {
          return Async.series(
            [cb => expectInviteRedirectToRegister(this.user, this.link, cb)],
            done
          )
        })

        return it('should allow user to accept the invite if the user registers a new account', function(done) {
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, this.link, cb),
              cb =>
                expectRegistrationRedirectToInvite(
                  this.user,
                  'some_email@example.com',
                  this.link,
                  cb
                ),
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectAcceptInviteAndRedirect(this.user, this.invite, cb),
              cb => expectProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })
      })

      describe('registration prompt workflow with non-valid token', function() {
        before(function(done) {
          return this.user.logout(done)
        })

        it('should redirect to the register page', function(done) {
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, this.link, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        return it('should display invalid-invite if the user registers a new account', function(done) {
          const badLink = this.link.replace(
            this.invite.token,
            'not_a_real_token'
          )
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, badLink, cb),
              cb =>
                expectRegistrationRedirectToInvite(
                  this.user,
                  'some_email@example.com',
                  badLink,
                  cb
                ),
              cb => expectInvalidInvitePage(this.user, badLink, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })
      })

      describe('login workflow with valid token', function() {
        before(function(done) {
          return this.user.logout(done)
        })

        it('should redirect to the register page', function(done) {
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, this.link, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        it('should allow the user to login to view the invite', function(done) {
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, this.link, cb),
              cb => expectLoginPage(this.user, cb),
              cb => expectLoginRedirectToInvite(this.user, this.link, cb),
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        return it('should allow user to accept the invite if the user registers a new account', function(done) {
          return Async.series(
            [
              cb => expectInvitePage(this.user, this.link, cb),
              cb => expectAcceptInviteAndRedirect(this.user, this.invite, cb),
              cb => expectProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })
      })

      return describe('login workflow with non-valid token', function() {
        before(function(done) {
          return this.user.logout(done)
        })

        it('should redirect to the register page', function(done) {
          return Async.series(
            [
              cb => expectInviteRedirectToRegister(this.user, this.link, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })

        return it('should show the invalid-invite page once the user has logged in', function(done) {
          const badLink = this.link.replace(
            this.invite.token,
            'not_a_real_token'
          )
          return Async.series(
            [
              cb => {
                return expectInviteRedirectToRegister(this.user, badLink, cb)
              },
              cb => {
                return expectLoginPage(this.user, cb)
              },
              cb => expectLoginRedirectToInvite(this.user, badLink, cb),
              cb => expectInvalidInvitePage(this.user, badLink, cb),
              cb => expectNoProjectAccess(this.user, this.invite.projectId, cb)
            ],
            done
          )
        })
      })
    })
  })
})
