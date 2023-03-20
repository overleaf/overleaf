// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')

const RealTimeClient = require('./helpers/RealTimeClient')
const MockWebServer = require('./helpers/MockWebServer')
const FixturesManager = require('./helpers/FixturesManager')

const async = require('async')

describe('joinProject', function () {
  describe('when authorized', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect()
            return this.client.on('connectionAccepted', cb)
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: this.project_id },
              (error, project, privilegeLevel, protocolVersion) => {
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb(error)
              }
            )
          },
        ],
        done
      )
    })

    it('should get the project from web', function () {
      return MockWebServer.joinProject
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    it('should return the project', function () {
      return this.project.should.deep.equal({
        name: 'Test Project',
      })
    })

    it('should return the privilege level', function () {
      return this.privilegeLevel.should.equal('owner')
    })

    it('should return the protocolVersion', function () {
      return this.protocolVersion.should.equal(2)
    })

    it('should have joined the project room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.project_id)).to.equal(
            true
          )
          return done()
        }
      )
    })

    return it('should have marked the user as connected', function (done) {
      return this.client.emit(
        'clientTracking.getConnectedUsers',
        (error, users) => {
          if (error) return done(error)
          let connected = false
          for (const user of Array.from(users)) {
            if (
              user.client_id === this.client.publicId &&
              user.user_id === this.user_id
            ) {
              connected = true
              break
            }
          }
          expect(connected).to.equal(true)
          return done()
        }
      )
    })
  })

  describe('when not authorized', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: null,
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect()
            return this.client.on('connectionAccepted', cb)
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: this.project_id },
              (error, project, privilegeLevel, protocolVersion) => {
                this.error = error
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      return this.error.message.should.equal('not authorized')
    })

    return it('should not have joined the project room', function (done) {
      return RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.project_id)).to.equal(
            false
          )
          return done()
        }
      )
    })
  })

  describe('when not authorized and web replies with a 403', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                project_id: '403403403403403403403403', // forbidden
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect()
            this.client.on('connectionAccepted', cb)
          },

          cb => {
            this.client.emit(
              'joinProject',
              { project_id: this.project_id },
              (error, project, privilegeLevel, protocolVersion) => {
                this.error = error
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      this.error.message.should.equal('not authorized')
    })

    it('should not have joined the project room', function (done) {
      RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.project_id)).to.equal(
            false
          )
          done()
        }
      )
    })
  })

  describe('when deleted and web replies with a 404', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                project_id: '404404404404404404404404', // not-found
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect()
            this.client.on('connectionAccepted', cb)
          },

          cb => {
            this.client.emit(
              'joinProject',
              { project_id: this.project_id },
              (error, project, privilegeLevel, protocolVersion) => {
                this.error = error
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an error', function () {
      this.error.code.should.equal('ProjectNotFound')
    })

    it('should not have joined the project room', function (done) {
      RealTimeClient.getConnectedClient(
        this.client.socket.sessionid,
        (error, client) => {
          if (error) return done(error)
          expect(Array.from(client.rooms).includes(this.project_id)).to.equal(
            false
          )
          done()
        }
      )
    })
  })

  describe('when invalid', function () {
    before(function (done) {
      MockWebServer.joinProject.resetHistory()
      return async.series(
        [
          cb => {
            this.client = RealTimeClient.connect()
            return this.client.on('connectionAccepted', cb)
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: 'invalid-id' },
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    it('should return an invalid id error', function () {
      this.error.message.should.equal('invalid id')
    })

    it('should not call to web', function () {
      MockWebServer.joinProject.called.should.equal(false)
    })
  })

  describe('when joining more than one project', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            return FixturesManager.setUpProject(
              {
                privilegeLevel: 'owner',
                project: {
                  name: 'Other Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.other_project_id = projectId
                this.other_user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            return FixturesManager.setUpProject(
              {
                user_id: this.other_user_id,
                privilegeLevel: 'owner',
                project: {
                  name: 'Test Project',
                },
              },
              (e, { project_id: projectId, user_id: userId }) => {
                this.project_id = projectId
                this.user_id = userId
                return cb(e)
              }
            )
          },

          cb => {
            this.client = RealTimeClient.connect()
            return this.client.on('connectionAccepted', cb)
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: this.project_id },
              (error, project, privilegeLevel, protocolVersion) => {
                this.project = project
                this.privilegeLevel = privilegeLevel
                this.protocolVersion = protocolVersion
                return cb(error)
              }
            )
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: this.other_project_id },
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    return it('should return an error', function () {
      this.error.message.should.equal('cannot join multiple projects')
    })
  })

  return describe('when over rate limit', function () {
    before(function (done) {
      return async.series(
        [
          cb => {
            this.client = RealTimeClient.connect()
            return this.client.on('connectionAccepted', cb)
          },

          cb => {
            return this.client.emit(
              'joinProject',
              { project_id: '429429429429429429429429' }, // rate-limited
              error => {
                this.error = error
                return cb()
              }
            )
          },
        ],
        done
      )
    })

    return it('should return a TooManyRequests error code', function () {
      this.error.message.should.equal('rate-limit hit when joining project')
      return this.error.code.should.equal('TooManyRequests')
    })
  })
})
