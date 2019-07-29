/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai')
chai.should()
const { expect } = chai
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/History/HistoryManager'
const SandboxedModule = require('sandboxed-module')

describe('HistoryManager', function() {
  beforeEach(function() {
    this.callback = sinon.stub()
    this.user_id = 'user-id-123'
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id)
    }
    this.HistoryManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        request: (this.request = sinon.stub()),
        'settings-sharelatex': (this.settings = {}),
        '../User/UserGetter': (this.UserGetter = {})
      }
    })
    return (this.settings.apis = {
      trackchanges: {
        enabled: false,
        url: 'http://trackchanges.example.com'
      },
      project_history: {
        url: 'http://project_history.example.com'
      }
    })
  })

  describe('initializeProject', function() {
    describe('with project history enabled', function() {
      beforeEach(function() {
        return (this.settings.apis.project_history.initializeHistoryForNewProjects = true)
      })

      describe('project history returns a successful response', function() {
        beforeEach(function() {
          this.overleaf_id = 1234
          this.res = { statusCode: 200 }
          this.body = JSON.stringify({ project: { id: this.overleaf_id } })
          this.request.post = sinon
            .stub()
            .callsArgWith(1, null, this.res, this.body)

          return this.HistoryManager.initializeProject(this.callback)
        })

        it('should call the project history api', function() {
          return this.request.post
            .calledWith({
              url: `${this.settings.apis.project_history.url}/project`
            })
            .should.equal(true)
        })

        it('should return the callback with the overleaf id', function() {
          return this.callback
            .calledWithExactly(null, { overleaf_id: this.overleaf_id })
            .should.equal(true)
        })
      })

      describe('project history returns a response without the project id', function() {
        beforeEach(function() {
          this.res = { statusCode: 200 }
          this.body = JSON.stringify({ project: {} })
          this.request.post = sinon
            .stub()
            .callsArgWith(1, null, this.res, this.body)

          return this.HistoryManager.initializeProject(this.callback)
        })

        it('should return the callback with an error', function() {
          return this.callback
            .calledWith(
              sinon.match.has(
                'message',
                'project-history did not provide an id'
              )
            )
            .should.equal(true)
        })
      })

      describe('project history returns a unsuccessful response', function() {
        beforeEach(function() {
          this.res = { statusCode: 404 }
          this.request.post = sinon.stub().callsArgWith(1, null, this.res)

          return this.HistoryManager.initializeProject(this.callback)
        })

        it('should return the callback with an error', function() {
          return this.callback
            .calledWith(
              sinon.match.has(
                'message',
                'project-history returned a non-success status code: 404'
              )
            )
            .should.equal(true)
        })
      })

      describe('project history errors', function() {
        beforeEach(function() {
          this.error = sinon.stub()
          this.request.post = sinon.stub().callsArgWith(1, this.error)

          return this.HistoryManager.initializeProject(this.callback)
        })

        it('should return the callback with the error', function() {
          return this.callback.calledWithExactly(this.error).should.equal(true)
        })
      })
    })

    describe('with project history disabled', function() {
      beforeEach(function() {
        this.settings.apis.project_history.initializeHistoryForNewProjects = false
        return this.HistoryManager.initializeProject(this.callback)
      })

      it('should return the callback', function() {
        return this.callback.calledWithExactly().should.equal(true)
      })
    })
  })

  describe('injectUserDetails', function() {
    beforeEach(function() {
      this.user1 = {
        _id: (this.user_id1 = '123456'),
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        overleaf: { id: 5011 }
      }
      this.user1_view = {
        id: this.user_id1,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com'
      }
      this.user2 = {
        _id: (this.user_id2 = 'abcdef'),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      }
      this.user2_view = {
        id: this.user_id2,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      }
      this.UserGetter.getUsersByV1Ids = sinon.stub().yields(null, [this.user1])
      return (this.UserGetter.getUsers = sinon
        .stub()
        .yields(null, [this.user1, this.user2]))
    })

    describe('with a diff', function() {
      it('should turn user_ids into user objects', function(done) {
        return this.HistoryManager.injectUserDetails(
          {
            diff: [
              {
                i: 'foo',
                meta: {
                  users: [this.user_id1]
                }
              },
              {
                i: 'bar',
                meta: {
                  users: [this.user_id2]
                }
              }
            ]
          },
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
            expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
            return done()
          }
        )
      })

      it('should handle v1 user ids', function(done) {
        return this.HistoryManager.injectUserDetails(
          {
            diff: [
              {
                i: 'foo',
                meta: {
                  users: [5011]
                }
              },
              {
                i: 'bar',
                meta: {
                  users: [this.user_id2]
                }
              }
            ]
          },
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
            expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
            return done()
          }
        )
      })

      it('should leave user objects', function(done) {
        return this.HistoryManager.injectUserDetails(
          {
            diff: [
              {
                i: 'foo',
                meta: {
                  users: [this.user1_view]
                }
              },
              {
                i: 'bar',
                meta: {
                  users: [this.user_id2]
                }
              }
            ]
          },
          (error, diff) => {
            expect(error).to.be.null
            expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
            expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
            return done()
          }
        )
      })
    })

    describe('with a list of updates', function() {
      it('should turn user_ids into user objects', function(done) {
        return this.HistoryManager.injectUserDetails(
          {
            updates: [
              {
                fromV: 5,
                toV: 8,
                meta: {
                  users: [this.user_id1]
                }
              },
              {
                fromV: 4,
                toV: 5,
                meta: {
                  users: [this.user_id2]
                }
              }
            ]
          },
          (error, updates) => {
            expect(error).to.be.null
            expect(updates.updates[0].meta.users).to.deep.equal([
              this.user1_view
            ])
            expect(updates.updates[1].meta.users).to.deep.equal([
              this.user2_view
            ])
            return done()
          }
        )
      })

      it('should leave user objects', function(done) {
        return this.HistoryManager.injectUserDetails(
          {
            updates: [
              {
                fromV: 5,
                toV: 8,
                meta: {
                  users: [this.user1_view]
                }
              },
              {
                fromV: 4,
                toV: 5,
                meta: {
                  users: [this.user_id2]
                }
              }
            ]
          },
          (error, updates) => {
            expect(error).to.be.null
            expect(updates.updates[0].meta.users).to.deep.equal([
              this.user1_view
            ])
            expect(updates.updates[1].meta.users).to.deep.equal([
              this.user2_view
            ])
            return done()
          }
        )
      })
    })
  })
})
