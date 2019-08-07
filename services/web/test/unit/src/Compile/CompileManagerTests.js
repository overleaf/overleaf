/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/CompileManager.js'
const { assert } = require('chai')
const SandboxedModule = require('sandboxed-module')

describe('CompileManager', function() {
  beforeEach(function() {
    let Timer
    this.rateLimitGetStub = sinon.stub()
    const { rateLimitGetStub } = this
    this.ratelimiter = { addCount: sinon.stub() }
    this.CompileManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = {
          redis: { web: { host: 'localhost', port: 42 } },
          rateLimit: { autoCompile: {} }
        }),
        '../../infrastructure/RedisWrapper': {
          client: () => {
            return (this.rclient = { auth() {} })
          }
        },
        '../Project/ProjectRootDocManager': (this.ProjectRootDocManager = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        './ClsiManager': (this.ClsiManager = {}),
        '../../infrastructure/RateLimiter': this.ratelimiter,
        'metrics-sharelatex': (this.Metrics = {
          Timer: (Timer = (function() {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
          inc: sinon.stub()
        }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          warn: sinon.stub()
        })
      }
    })
    this.project_id = 'mock-project-id-123'
    this.user_id = 'mock-user-id-123'
    this.callback = sinon.stub()
    return (this.limits = {
      timeout: 42
    })
  })

  describe('compile', function() {
    beforeEach(function() {
      this.CompileManager._checkIfRecentlyCompiled = sinon
        .stub()
        .callsArgWith(2, null, false)
      this.ProjectRootDocManager.ensureRootDocumentIsSet = sinon
        .stub()
        .callsArgWith(1, null)
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(1, null, this.limits)
      return (this.ClsiManager.sendRequest = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          (this.status = 'mock-status'),
          (this.outputFiles = 'mock output files'),
          (this.output = 'mock output')
        ))
    })

    describe('succesfully', function() {
      beforeEach(function() {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = (
          isAutoCompile,
          compileGroup,
          cb
        ) => cb(null, true)
        return this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should check the project has not been recently compiled', function() {
        return this.CompileManager._checkIfRecentlyCompiled
          .calledWith(this.project_id, this.user_id)
          .should.equal(true)
      })

      it('should ensure that the root document is set', function() {
        return this.ProjectRootDocManager.ensureRootDocumentIsSet
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get the project compile limits', function() {
        return this.CompileManager.getProjectCompileLimits
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should run the compile with the compile limits', function() {
        return this.ClsiManager.sendRequest
          .calledWith(this.project_id, this.user_id, {
            timeout: this.limits.timeout
          })
          .should.equal(true)
      })

      it('should call the callback with the output', function() {
        return this.callback
          .calledWith(null, this.status, this.outputFiles, this.output)
          .should.equal(true)
      })

      it('should time the compile', function() {
        return this.Metrics.Timer.prototype.done.called.should.equal(true)
      })

      it('should log out the compile', function() {
        return this.logger.log
          .calledWith(
            { project_id: this.project_id, user_id: this.user_id },
            'compiling project'
          )
          .should.equal(true)
      })
    })

    describe('when the project has been recently compiled', function() {
      it('should return', function(done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = (
          isAutoCompile,
          compileGroup,
          cb
        ) => cb(null, true)
        this.CompileManager._checkIfRecentlyCompiled = sinon
          .stub()
          .callsArgWith(2, null, true)
        return this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          (err, status) => {
            status.should.equal('too-recently-compiled')
            return done()
          }
        )
      })
    })

    describe('should check the rate limit', function() {
      it('should return', function(done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = sinon
          .stub()
          .callsArgWith(2, null, false)
        return this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          (err, status) => {
            status.should.equal('autocompile-backoff')
            return done()
          }
        )
      })
    })
  })

  describe('getProjectCompileLimits', function() {
    beforeEach(function() {
      this.features = {
        compileTimeout: (this.timeout = 42),
        compileGroup: (this.group = 'priority')
      }
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(
          2,
          null,
          (this.project = { owner_ref: (this.owner_id = 'owner-id-123') })
        )
      this.UserGetter.getUser = sinon
        .stub()
        .callsArgWith(2, null, (this.user = { features: this.features }))
      return this.CompileManager.getProjectCompileLimits(
        this.project_id,
        this.callback
      )
    })

    it('should look up the owner of the project', function() {
      return this.ProjectGetter.getProject
        .calledWith(this.project_id, { owner_ref: 1 })
        .should.equal(true)
    })

    it("should look up the owner's features", function() {
      return this.UserGetter.getUser
        .calledWith(this.project.owner_ref, { features: 1 })
        .should.equal(true)
    })

    it('should return the limits', function() {
      return this.callback
        .calledWith(null, {
          timeout: this.timeout,
          compileGroup: this.group
        })
        .should.equal(true)
    })
  })

  describe('deleteAuxFiles', function() {
    beforeEach(function() {
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          (this.limits = { compileGroup: 'mock-compile-group' })
        )
      this.ClsiManager.deleteAuxFiles = sinon.stub().callsArg(3)
      return this.CompileManager.deleteAuxFiles(
        this.project_id,
        this.user_id,
        this.callback
      )
    })

    it('should look up the compile group to use', function() {
      return this.CompileManager.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should delete the aux files', function() {
      return this.ClsiManager.deleteAuxFiles
        .calledWith(this.project_id, this.user_id, this.limits)
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })

  describe('_checkIfRecentlyCompiled', function() {
    describe('when the key exists in redis', function() {
      beforeEach(function() {
        this.rclient.set = sinon.stub().callsArgWith(5, null, null)
        return this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should try to set the key', function() {
        return this.rclient.set
          .calledWith(
            `compile:${this.project_id}:${this.user_id}`,
            true,
            'EX',
            this.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should call the callback with true', function() {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the key does not exist in redis', function() {
      beforeEach(function() {
        this.rclient.set = sinon.stub().callsArgWith(5, null, 'OK')
        return this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should try to set the key', function() {
        return this.rclient.set
          .calledWith(
            `compile:${this.project_id}:${this.user_id}`,
            true,
            'EX',
            this.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should call the callback with false', function() {
        return this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })

  describe('_checkIfAutoCompileLimitHasBeenHit', function() {
    it('should be able to compile if it is not an autocompile', function(done) {
      this.ratelimiter.addCount.callsArgWith(2, null, true)
      return this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        false,
        'everyone',
        (err, canCompile) => {
          canCompile.should.equal(true)
          return done()
        }
      )
    })

    it('should be able to compile if rate limit has remianing', function(done) {
      this.ratelimiter.addCount.callsArgWith(1, null, true)
      return this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          const args = this.ratelimiter.addCount.args[0][0]
          args.throttle.should.equal(25)
          args.subjectName.should.equal('everyone')
          args.timeInterval.should.equal(20)
          args.endpointName.should.equal('auto_compile')
          canCompile.should.equal(true)
          return done()
        }
      )
    })

    it('should be not able to compile if rate limit has no remianing', function(done) {
      this.ratelimiter.addCount.callsArgWith(1, null, false)
      return this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          canCompile.should.equal(false)
          return done()
        }
      )
    })

    it('should return false if there is an error in the rate limit', function(done) {
      this.ratelimiter.addCount.callsArgWith(1, 'error')
      return this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          canCompile.should.equal(false)
          return done()
        }
      )
    })
  })

  describe('wordCount', function() {
    beforeEach(function() {
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          (this.limits = { compileGroup: 'mock-compile-group' })
        )
      this.ClsiManager.wordCount = sinon.stub().callsArg(4)
      return this.CompileManager.wordCount(
        this.project_id,
        this.user_id,
        false,
        this.callback
      )
    })

    it('should look up the compile group to use', function() {
      return this.CompileManager.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call wordCount for project', function() {
      return this.ClsiManager.wordCount
        .calledWith(this.project_id, this.user_id, false, this.limits)
        .should.equal(true)
    })

    it('should call the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })
})
