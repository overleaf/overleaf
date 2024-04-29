const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/Features/Compile/CompileManager.js'

describe('CompileManager', function () {
  beforeEach(function () {
    this.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    this.RateLimiter = {
      RateLimiter: sinon.stub().returns(this.rateLimiter),
    }
    this.timer = {
      done: sinon.stub(),
    }
    this.Metrics = {
      Timer: sinon.stub().returns(this.timer),
      inc: sinon.stub(),
    }
    this.CompileManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': (this.settings = {
          apis: {
            clsi: { submissionBackendClass: 'n2d' },
          },
          redis: { web: { host: '127.0.0.1', port: 42 } },
          rateLimit: { autoCompile: {} },
        }),
        '../../infrastructure/RedisWrapper': {
          client: () =>
            (this.rclient = {
              auth() {},
            }),
        },
        '../Project/ProjectRootDocManager': (this.ProjectRootDocManager = {
          promises: {},
        }),
        '../Project/ProjectGetter': (this.ProjectGetter = { promises: {} }),
        '../User/UserGetter': (this.UserGetter = { promises: {} }),
        './ClsiManager': (this.ClsiManager = { promises: {} }),
        '../../infrastructure/RateLimiter': this.RateLimiter,
        '@overleaf/metrics': this.Metrics,
        '../Analytics/UserAnalyticsIdCache': (this.UserAnalyticsIdCache = {
          get: sinon.stub().resolves('abc'),
        }),
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
        .resolves(false)
      this.ProjectRootDocManager.promises.ensureRootDocumentIsSet = sinon
        .stub()
        .resolves()
      this.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves(this.limits)
      this.ClsiManager.promises.sendRequest = sinon.stub().resolves({
        status: (this.status = 'mock-status'),
        outputFiles: (this.outputFiles = []),
        clsiServerId: (this.output = 'mock output'),
      })
    })

    describe('succesfully', function () {
      let result
      beforeEach(async function () {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = async (
          isAutoCompile,
          compileGroup
        ) => true
        this.ProjectGetter.promises.getProject = sinon
          .stub()
          .resolves(
            (this.project = { owner_ref: (this.owner_id = 'owner-id-123') })
          )
        this.UserGetter.promises.getUser = sinon.stub().resolves(
          (this.user = {
            features: { compileTimeout: '20s', compileGroup: 'standard' },
            analyticsId: 'abc',
          })
        )
        result = await this.CompileManager.promises.compile(
          this.project_id,
          this.user_id,
          {}
        )
      })

      it('should check the project has not been recently compiled', function () {
        this.CompileManager._checkIfRecentlyCompiled
          .calledWith(this.project_id, this.user_id)
          .should.equal(true)
      })

      it('should ensure that the root document is set', function () {
        this.ProjectRootDocManager.promises.ensureRootDocumentIsSet
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should get the project compile limits', function () {
        this.CompileManager.promises.getProjectCompileLimits
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should run the compile with the compile limits', function () {
        this.ClsiManager.promises.sendRequest
          .calledWith(this.project_id, this.user_id, {
            timeout: this.limits.timeout,
            compileGroup: 'standard',
          })
          .should.equal(true)
      })

      it('should resolve with the output', function () {
        expect(result).to.haveOwnProperty('status', this.status)
        expect(result).to.haveOwnProperty('clsiServerId', this.output)
        expect(result).to.haveOwnProperty('outputFiles', this.outputFiles)
      })

      it('should time the compile', function () {
        this.timer.done.called.should.equal(true)
      })
    })

    describe('when the project has been recently compiled', function () {
      it('should return', function (done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = async (
          isAutoCompile,
          compileGroup
        ) => true
        this.CompileManager._checkIfRecentlyCompiled = sinon
          .stub()
          .resolves(true)
        this.CompileManager.promises
          .compile(this.project_id, this.user_id, {})
          .then(({ status }) => {
            status.should.equal('too-recently-compiled')
            done()
          })
          .catch(error => {
            // Catch any errors and fail the test
            true.should.equal(false)
            done(error)
          })
      })
    })

    describe('should check the rate limit', function () {
      it('should return', function (done) {
        this.CompileManager._checkIfAutoCompileLimitHasBeenHit = sinon
          .stub()
          .resolves(false)
        this.CompileManager.promises
          .compile(this.project_id, this.user_id, {})
          .then(({ status }) => {
            expect(status).to.equal('autocompile-backoff')
            done()
          })
          .catch(err => done(err))
      })
    })
  })

  describe('getProjectCompileLimits', function () {
    beforeEach(async function () {
      this.features = {
        compileTimeout: (this.timeout = 42),
        compileGroup: (this.group = 'priority'),
      }
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves(
          (this.project = { owner_ref: (this.owner_id = 'owner-id-123') })
        )
      this.UserGetter.promises.getUser = sinon
        .stub()
        .resolves((this.user = { features: this.features, analyticsId: 'abc' }))
      try {
        const result =
          await this.CompileManager.promises.getProjectCompileLimits(
            this.project_id
          )
        this.callback(null, result)
      } catch (error) {
        this.callback(error)
      }
    })

    it('should look up the owner of the project', function () {
      this.ProjectGetter.promises.getProject
        .calledWith(this.project_id, { owner_ref: 1 })
        .should.equal(true)
    })

    it("should look up the owner's features", function () {
      this.UserGetter.promises.getUser
        .calledWith(this.project.owner_ref, {
          _id: 1,
          alphaProgram: 1,
          analyticsId: 1,
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
          compileBackendClass: 'c2d',
          ownerAnalyticsId: 'abc',
        })
        .should.equal(true)
    })
  })

  describe('compileBackendClass', function () {
    beforeEach(function () {
      this.features = {
        compileTimeout: 42,
        compileGroup: 'standard',
      }
      this.ProjectGetter.promises.getProject = sinon
        .stub()
        .resolves({ owner_ref: 'owner-id-123' })
      this.UserGetter.promises.getUser = sinon
        .stub()
        .resolves({ features: this.features, analyticsId: 'abc' })
    })

    describe('with priority compile', function () {
      beforeEach(function () {
        this.features.compileGroup = 'priority'
      })
      it('should return the default class', function (done) {
        this.CompileManager.getProjectCompileLimits(
          this.project_id,
          (err, { compileBackendClass }) => {
            if (err) return done(err)
            expect(compileBackendClass).to.equal('c2d')
            done()
          }
        )
      })
    })
  })

  describe('deleteAuxFiles', function () {
    let result

    beforeEach(async function () {
      this.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves((this.limits = { compileGroup: 'mock-compile-group' }))
      this.ClsiManager.promises.deleteAuxFiles = sinon.stub().resolves('test')
      result = await this.CompileManager.promises.deleteAuxFiles(
        this.project_id,
        this.user_id
      )
    })

    it('should look up the compile group to use', function () {
      this.CompileManager.promises.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should delete the aux files', function () {
      this.ClsiManager.promises.deleteAuxFiles
        .calledWith(this.project_id, this.user_id, this.limits)
        .should.equal(true)
    })

    it('should resolve', function () {
      expect(result).not.to.be.undefined
    })
  })

  describe('_checkIfRecentlyCompiled', function () {
    describe('when the key exists in redis', function () {
      let result

      beforeEach(async function () {
        this.rclient.set = sinon.stub().resolves(null)
        result = await this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id
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

      it('should resolve with true', function () {
        result.should.equal(true)
      })
    })

    describe('when the key does not exist in redis', function () {
      let result

      beforeEach(async function () {
        this.rclient.set = sinon.stub().resolves('OK')
        result = await this.CompileManager._checkIfRecentlyCompiled(
          this.project_id,
          this.user_id
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

      it('should resolve with false', function () {
        result.should.equal(false)
      })
    })
  })

  describe('_checkIfAutoCompileLimitHasBeenHit', function () {
    it('should be able to compile if it is not an autocompile', async function () {
      const canCompile =
        await this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          false,
          'everyone'
        )
      expect(canCompile).to.equal(true)
    })

    it('should be able to compile if rate limit has remaining', async function () {
      const canCompile =
        await this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(this.rateLimiter.consume).to.have.been.calledWith('global')
      expect(canCompile).to.equal(true)
    })

    it('should be not able to compile if rate limit has no remianing', async function () {
      this.rateLimiter.consume.rejects({ remainingPoints: 0 })
      const canCompile =
        await this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(canCompile).to.equal(false)
    })

    it('should return false if there is an error in the rate limit', async function () {
      this.rateLimiter.consume.rejects(new Error('BOOM!'))
      const canCompile =
        await this.CompileManager._checkIfAutoCompileLimitHasBeenHit(
          true,
          'everyone'
        )

      expect(canCompile).to.equal(false)
    })
  })

  describe('wordCount', function () {
    let result
    const wordCount = 1

    beforeEach(async function () {
      this.CompileManager.promises.getProjectCompileLimits = sinon
        .stub()
        .resolves((this.limits = { compileGroup: 'mock-compile-group' }))
      this.ClsiManager.promises.wordCount = sinon.stub().resolves(wordCount)
      result = await this.CompileManager.promises.wordCount(
        this.project_id,
        this.user_id,
        false
      )
    })

    it('should look up the compile group to use', function () {
      this.CompileManager.promises.getProjectCompileLimits
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call wordCount for project', function () {
      this.ClsiManager.promises.wordCount
        .calledWith(this.project_id, this.user_id, false, this.limits)
        .should.equal(true)
    })

    it('should resolve with the wordCount from the ClsiManager', function () {
      expect(result).to.equal(wordCount)
    })
  })
})
