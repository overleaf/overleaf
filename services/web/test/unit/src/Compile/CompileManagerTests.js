const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Compile/CompileManager.js'
const SandboxedModule = require('sandboxed-module')

describe('CompileManager', function () {
  beforeEach(function () {
    this.rateLimitGetStub = sinon.stub()
    this.ratelimiter = { addCount: sinon.stub() }
    this.timer = {
      done: sinon.stub(),
    }
    this.Metrics = {
      Timer: sinon.stub().returns(this.timer),
      inc: sinon.stub(),
    }
    this.CompileManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {
          redis: { web: { host: 'localhost', port: 42 } },
          rateLimit: { autoCompile: {} },
        }),
        '../../infrastructure/RedisWrapper': {
          client: () => (this.rclient = { auth() {} }),
        },
        '../Project/ProjectRootDocManager': (this.ProjectRootDocManager = {}),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../User/UserGetter': (this.UserGetter = {}),
        './ClsiManager': (this.ClsiManager = {}),
        '../../infrastructure/RateLimiter': this.ratelimiter,
        '@overleaf/metrics': this.Metrics,
      },
    })
    this.project_id = 'mock-project-id-123'
    this.user_id = 'mock-user-id-123'
    this.callback = sinon.stub()
    this.limits = {
      timeout: 42,
      compileGroup: 'standard',
    }
  })

  describe('compile', function () {
    beforeEach(function () {
      this.CompileManager._checkIfRecentlyCompiled = sinon
        .stub()
        .callsArgWith(2, null, false)
      this.ProjectRootDocManager.ensureRootDocumentIsSet = sinon
        .stub()
        .callsArgWith(1, null)
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(1, null, this.limits)
      this.ClsiManager.sendRequest = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          (this.status = 'mock-status'),
          (this.outputFiles = 'mock output files'),
          (this.output = 'mock output')
        )
    })

    describe('succesfully', function () {
      beforeEach(function () {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = (
          isAutoCompile,
          compileGroup,
          cb
        ) => cb(null, true)
        this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          this.callback
        )
      })

      it('should check the project has not been recently compiled', function () {
        this.CompileManager._checkIfRecentlyCompiled
          .calledWith(this.project_id, this.user_id)
          .should.equal(true)
      })

      it('should ensure that the root document is set', function () {
        this.ProjectRootDocManager.ensureRootDocumentIsSet
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get the project compile limits', function () {
        this.CompileManager.getProjectCompileLimits
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should run the compile with the compile limits', function () {
        this.ClsiManager.sendRequest
          .calledWith(this.project_id, this.user_id, {
            timeout: this.limits.timeout,
            compileGroup: 'standard',
          })
          .should.equal(true)
      })

      it('should call the callback with the output', function () {
        this.callback
          .calledWith(null, this.status, this.outputFiles, this.output)
          .should.equal(true)
      })

      it('should time the compile', function () {
        this.timer.done.called.should.equal(true)
      })
    })

    describe('when the project has been recently compiled', function () {
      it('should return', function (done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = (
          isAutoCompile,
          compileGroup,
          cb
        ) => cb(null, true)
        this.CompileManager._checkIfRecentlyCompiled = sinon
          .stub()
          .callsArgWith(2, null, true)
        this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            status.should.equal('too-recently-compiled')
            done()
          }
        )
      })
    })

    describe('should check the rate limit', function () {
      it('should return', function (done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = sinon
          .stub()
          .callsArgWith(2, null, false)
        this.CompileManager.compile(
          this.project_id,
          this.user_id,
          {},
          (err, status) => {
            if (err) {
              return done(err)
            }
            status.should.equal('autocompile-backoff')
            done()
          }
        )
      })
    })
  })

  describe('getProjectCompileLimits', function () {
    beforeEach(function () {
      this.features = {
        compileTimeout: (this.timeout = 42),
        compileGroup: (this.group = 'priority'),
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
      this.CompileManager.getProjectCompileLimits(
        this.project_id,
        this.callback
      )
    })

    it('should look up the owner of the project', function () {
      this.ProjectGetter.getProject
        .calledWith(this.project_id, { owner_ref: 1 })
        .should.equal(true)
    })

    it("should look up the owner's features", function () {
      this.UserGetter.getUser
        .calledWith(this.project.owner_ref, {
          alphaProgram: 1,
          betaProgram: 1,
          features: 1,
        })
        .should.equal(true)
    })

    it('should return the limits', function () {
      this.callback
        .calledWith(null, {
          timeout: this.timeout,
          compileGroup: this.group,
        })
        .should.equal(true)
    })
  })

  describe('deleteAuxFiles', function () {
    beforeEach(function () {
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          (this.limits = { compileGroup: 'mock-compile-group' })
        )
      this.ClsiManager.deleteAuxFiles = sinon.stub().callsArg(3)
      this.CompileManager.deleteAuxFiles(
        this.project_id,
        this.user_id,
        this.callback
      )
    })

    it('should look up the compile group to use', function () {
      this.CompileManager.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should delete the aux files', function () {
      this.ClsiManager.deleteAuxFiles
        .calledWith(this.project_id, this.user_id, this.limits)
        .should.equal(true)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })
  })

  describe('_checkIfRecentlyCompiled', function () {
    describe('when the key exists in redis', function () {
      beforeEach(function () {
        this.rclient.set = sinon.stub().callsArgWith(5, null, null)
        this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should try to set the key', function () {
        this.rclient.set
          .calledWith(
            `compile:${this.project_id}:${this.user_id}`,
            true,
            'EX',
            this.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should call the callback with true', function () {
        this.callback.calledWith(null, true).should.equal(true)
      })
    })

    describe('when the key does not exist in redis', function () {
      beforeEach(function () {
        this.rclient.set = sinon.stub().callsArgWith(5, null, 'OK')
        this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id,
          this.callback
        )
      })

      it('should try to set the key', function () {
        this.rclient.set
          .calledWith(
            `compile:${this.project_id}:${this.user_id}`,
            true,
            'EX',
            this.CompileManager.COMPILE_DELAY,
            'NX'
          )
          .should.equal(true)
      })

      it('should call the callback with false', function () {
        this.callback.calledWith(null, false).should.equal(true)
      })
    })
  })

  describe('_checkIfAutoCompileLimitHasBeenHit', function () {
    it('should be able to compile if it is not an autocompile', function (done) {
      this.ratelimiter.addCount.callsArgWith(2, null, true)
      this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        false,
        'everyone',
        (err, canCompile) => {
          if (err) {
            return done(err)
          }
          canCompile.should.equal(true)
          done()
        }
      )
    })

    it('should be able to compile if rate limit has remianing', function (done) {
      this.ratelimiter.addCount.callsArgWith(1, null, true)
      this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          if (err) {
            return done(err)
          }
          const args = this.ratelimiter.addCount.args[0][0]
          args.throttle.should.equal(25)
          args.subjectName.should.equal('everyone')
          args.timeInterval.should.equal(20)
          args.endpointName.should.equal('auto_compile')
          canCompile.should.equal(true)
          done()
        }
      )
    })

    it('should be not able to compile if rate limit has no remianing', function (done) {
      this.ratelimiter.addCount.callsArgWith(1, null, false)
      this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          if (err) {
            return done(err)
          }
          canCompile.should.equal(false)
          done()
        }
      )
    })

    it('should return false if there is an error in the rate limit', function (done) {
      this.ratelimiter.addCount.callsArgWith(1, 'error')
      this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
        true,
        'everyone',
        (err, canCompile) => {
          if (err) {
            return done(err)
          }
          canCompile.should.equal(false)
          done()
        }
      )
    })
  })

  describe('wordCount', function () {
    beforeEach(function () {
      this.CompileManager.getProjectCompileLimits = sinon
        .stub()
        .callsArgWith(
          1,
          null,
          (this.limits = { compileGroup: 'mock-compile-group' })
        )
      this.ClsiManager.wordCount = sinon.stub().callsArg(4)
      this.CompileManager.wordCount(
        this.project_id,
        this.user_id,
        false,
        this.callback
      )
    })

    it('should look up the compile group to use', function () {
      this.CompileManager.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call wordCount for project', function () {
      this.ClsiManager.wordCount
        .calledWith(this.project_id, this.user_id, false, this.limits)
        .should.equal(true)
    })

    it('should call the callback', function () {
      this.callback.called.should.equal(true)
    })
  })
})
