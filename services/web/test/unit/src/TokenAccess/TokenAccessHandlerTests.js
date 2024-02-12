const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/TokenAccess/TokenAccessHandler'
)
const { expect } = require('chai')
const { ObjectId } = require('mongodb')

describe('TokenAccessHandler', function () {
  beforeEach(function () {
    this.token = 'abcdefabcdef'
    this.projectId = new ObjectId()
    this.project = {
      _id: this.projectId,
      publicAccesLevel: 'tokenBased',
      owner_ref: new ObjectId(),
    }
    this.userId = new ObjectId()
    this.req = {}
    this.TokenAccessHandler = SandboxedModule.require(modulePath, {
      requires: {
        mongodb: { ObjectId },
        '../../models/Project': { Project: (this.Project = {}) },
        '@overleaf/metrics': (this.Metrics = { inc: sinon.stub() }),
        '@overleaf/settings': (this.settings = {}),
        '../V1/V1Api': (this.V1Api = {
          request: sinon.stub(),
        }),
        crypto: (this.Crypto = require('crypto')),
        '../Analytics/AnalyticsManager': (this.Analytics = {
          recordEventForUser: sinon.stub(),
        }),
      },
    })
  })

  describe('getTokenType', function () {
    it('should determine tokens correctly', function () {
      const specs = {
        abcdefabcdef: 'readOnly',
        aaaaaabbbbbb: 'readOnly',
        '54325aaaaaa': 'readAndWrite',
        '54325aaaaaabbbbbb': 'readAndWrite',
        '': null,
        abc123def: null,
      }
      for (const token of Object.keys(specs)) {
        expect(this.TokenAccessHandler.getTokenType(token)).to.equal(
          specs[token]
        )
      }
    })
  })

  describe('getProjectByReadOnlyToken', function () {
    beforeEach(function () {
      this.token = 'abcdefabcdef'
      this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
    })

    it('should get the project', function (done) {
      this.TokenAccessHandler.getProjectByReadOnlyToken(
        this.token,
        (err, project) => {
          expect(err).to.not.exist
          expect(project).to.exist
          expect(this.Project.findOne.callCount).to.equal(1)
          done()
        }
      )
    })
  })

  describe('getProjectByReadAndWriteToken', function () {
    beforeEach(function () {
      sinon.spy(this.Crypto, 'timingSafeEqual')
      this.token = '1234abcdefabcdef'
      this.project.tokens = {
        readAndWrite: this.token,
        readAndWritePrefix: '1234',
      }
      this.Project.findOne = sinon.stub().callsArgWith(2, null, this.project)
    })

    afterEach(function () {
      this.Crypto.timingSafeEqual.restore()
    })

    it('should get the project and do timing-safe comparison', function (done) {
      this.TokenAccessHandler.getProjectByReadAndWriteToken(
        this.token,
        (err, project) => {
          expect(err).to.not.exist
          expect(project).to.exist
          expect(this.Crypto.timingSafeEqual.callCount).to.equal(1)
          expect(
            this.Crypto.timingSafeEqual.calledWith(Buffer.from(this.token))
          ).to.equal(true)
          expect(this.Project.findOne.callCount).to.equal(1)
          done()
        }
      )
    })
  })

  describe('addReadOnlyUserToProject', function () {
    beforeEach(function () {
      this.Project.updateOne = sinon.stub().callsArgWith(2, null)
    })

    it('should call Project.updateOne', function (done) {
      this.TokenAccessHandler.addReadOnlyUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          expect(this.Project.updateOne.callCount).to.equal(1)
          expect(
            this.Project.updateOne.calledWith({
              _id: this.projectId,
            })
          ).to.equal(true)
          expect(
            this.Project.updateOne.lastCall.args[1].$addToSet
          ).to.have.keys('tokenAccessReadOnly_refs')
          sinon.assert.calledWith(
            this.Analytics.recordEventForUser,
            this.userId,
            'project-joined',
            { mode: 'read-only' }
          )
          done()
        }
      )
    })

    it('should not produce an error', function (done) {
      this.TokenAccessHandler.addReadOnlyUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          done()
        }
      )
    })

    describe('when Project.updateOne produces an error', function () {
      beforeEach(function () {
        this.Project.updateOne = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function (done) {
        this.TokenAccessHandler.addReadOnlyUserToProject(
          this.userId,
          this.projectId,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })
    })
  })

  describe('addReadAndWriteUserToProject', function () {
    beforeEach(function () {
      this.Project.updateOne = sinon.stub().callsArgWith(2, null)
    })

    it('should call Project.updateOne', function (done) {
      this.TokenAccessHandler.addReadAndWriteUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          expect(this.Project.updateOne.callCount).to.equal(1)
          expect(
            this.Project.updateOne.calledWith({
              _id: this.projectId,
            })
          ).to.equal(true)
          expect(
            this.Project.updateOne.lastCall.args[1].$addToSet
          ).to.have.keys('tokenAccessReadAndWrite_refs')
          sinon.assert.calledWith(
            this.Analytics.recordEventForUser,
            this.userId,
            'project-joined',
            { mode: 'read-write' }
          )
          done()
        }
      )
    })

    it('should not produce an error', function (done) {
      this.TokenAccessHandler.addReadAndWriteUserToProject(
        this.userId,
        this.projectId,
        err => {
          expect(err).to.not.exist
          done()
        }
      )
    })

    describe('when Project.updateOne produces an error', function () {
      beforeEach(function () {
        this.Project.updateOne = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function (done) {
        this.TokenAccessHandler.addReadAndWriteUserToProject(
          this.userId,
          this.projectId,
          err => {
            expect(err).to.exist
            done()
          }
        )
      })
    })
  })

  describe('grantSessionTokenAccess', function () {
    beforeEach(function () {
      this.req = { session: {}, headers: {} }
    })

    it('should add the token to the session', function (done) {
      this.TokenAccessHandler.grantSessionTokenAccess(
        this.req,
        this.projectId,
        this.token
      )
      expect(
        this.req.session.anonTokenAccess[this.projectId.toString()]
      ).to.equal(this.token)
      done()
    })
  })

  describe('validateTokenForAnonymousAccess', function () {
    describe('when a read-only project is found', function () {
      beforeEach(function () {
        this.TokenAccessHandler.getTokenType = sinon.stub().returns('readOnly')
        this.TokenAccessHandler.getProjectByToken = sinon
          .stub()
          .callsArgWith(2, null, this.project)
      })

      it('should try to find projects with both kinds of token', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(err).to.not.exist
            expect(
              this.TokenAccessHandler.getProjectByToken.callCount
            ).to.equal(1)
            done()
          }
        )
      })

      it('should allow read-only access', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(false)
            expect(ro).to.equal(true)
            done()
          }
        )
      })
    })

    describe('when a read-and-write project is found', function () {
      beforeEach(function () {
        this.TokenAccessHandler.getTokenType = sinon
          .stub()
          .returns('readAndWrite')
        this.TokenAccessHandler.getProjectByToken = sinon
          .stub()
          .callsArgWith(2, null, this.project)
      })

      describe('when Anonymous token access is not enabled', function (done) {
        beforeEach(function () {
          this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
        })

        it('should try to find projects with both kinds of token', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(
                this.TokenAccessHandler.getProjectByToken.callCount
              ).to.equal(1)
              done()
            }
          )
        })

        it('should not allow read-and-write access', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              done()
            }
          )
        })
      })

      describe('when anonymous token access is enabled', function (done) {
        beforeEach(function () {
          this.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = true
        })

        it('should try to find projects with both kinds of token', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(
                this.TokenAccessHandler.getProjectByToken.callCount
              ).to.equal(1)
              done()
            }
          )
        })

        it('should allow read-and-write access', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(true)
              expect(ro).to.equal(false)
              done()
            }
          )
        })
      })
    })

    describe('when no project is found', function () {
      beforeEach(function () {
        this.TokenAccessHandler.getProjectByToken = sinon
          .stub()
          .callsArgWith(2, null, null, null)
      })

      it('should try to find projects with both kinds of token', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(err).to.not.exist
            expect(
              this.TokenAccessHandler.getProjectByToken.callCount
            ).to.equal(1)
            done()
          }
        )
      })

      it('should not allow any access', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.not.exist
            expect(rw).to.equal(false)
            expect(ro).to.equal(false)
            done()
          }
        )
      })
    })

    describe('when findProject produces an error', function () {
      beforeEach(function () {
        this.TokenAccessHandler.getProjectByToken = sinon
          .stub()
          .callsArgWith(2, new Error('woops'))
      })

      it('should try to find projects with both kinds of token', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, allowed) => {
            expect(err).to.exist
            expect(allowed).to.not.exist
            expect(
              this.TokenAccessHandler.getProjectByToken.callCount
            ).to.equal(1)
            done()
          }
        )
      })

      it('should produce an error and not allow access', function (done) {
        this.TokenAccessHandler.validateTokenForAnonymousAccess(
          this.projectId,
          this.token,
          (err, rw, ro) => {
            expect(err).to.exist
            expect(err).to.be.instanceof(Error)
            expect(rw).to.equal(undefined)
            expect(ro).to.equal(undefined)
            done()
          }
        )
      })
    })

    describe('when project is not set to token-based access', function () {
      beforeEach(function () {
        this.project.publicAccesLevel = 'private'
      })

      describe('for read-and-write project', function () {
        beforeEach(function () {
          this.TokenAccessHandler.getTokenType = sinon
            .stub()
            .returns('readAndWrite')
          this.TokenAccessHandler.getProjectByToken = sinon
            .stub()
            .callsArgWith(2, null, this.project)
        })

        it('should not allow any access', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              done()
            }
          )
        })
      })

      describe('for read-only project', function () {
        beforeEach(function () {
          this.TokenAccessHandler.getTokenType = sinon
            .stub()
            .returns('readOnly')
          this.TokenAccessHandler.getProjectByToken = sinon
            .stub()
            .callsArgWith(2, null, this.project)
        })

        it('should not allow any access', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            this.token,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              done()
            }
          )
        })
      })

      describe('with nothing', function () {
        beforeEach(function () {
          this.TokenAccessHandler.getProjectByToken = sinon
            .stub()
            .callsArgWith(1, null, null, null)
        })

        it('should not allow any access', function (done) {
          this.TokenAccessHandler.validateTokenForAnonymousAccess(
            this.projectId,
            null,
            (err, rw, ro) => {
              expect(err).to.not.exist
              expect(rw).to.equal(false)
              expect(ro).to.equal(false)
              done()
            }
          )
        })
      })
    })
  })

  describe('getDocPublishedInfo', function () {
    beforeEach(function () {
      this.callback = sinon.stub()
    })

    describe('when v1 api not set', function () {
      beforeEach(function () {
        this.settings.apis = { v1: undefined }
        this.TokenAccessHandler.getV1DocPublishedInfo(this.token, this.callback)
      })

      it('should not check access and return default info', function () {
        expect(this.V1Api.request.called).to.equal(false)
        expect(
          this.callback.calledWith(null, {
            allow: true,
          })
        ).to.equal(true)
      })
    })

    describe('when v1 api is set', function () {
      beforeEach(function () {
        this.settings.apis = { v1: { url: 'v1Url' } }
      })

      describe('on V1Api.request success', function () {
        beforeEach(function () {
          this.V1Api.request = sinon
            .stub()
            .callsArgWith(1, null, null, 'mock-data')
          this.TokenAccessHandler.getV1DocPublishedInfo(
            this.token,
            this.callback
          )
        })

        it('should return response body', function () {
          expect(
            this.V1Api.request.calledWith({
              url: `/api/v1/overleaf/docs/${this.token}/is_published`,
            })
          ).to.equal(true)
          expect(this.callback.calledWith(null, 'mock-data')).to.equal(true)
        })
      })

      describe('on V1Api.request error', function () {
        beforeEach(function () {
          this.V1Api.request = sinon.stub().callsArgWith(1, 'error')
          this.TokenAccessHandler.getV1DocPublishedInfo(
            this.token,
            this.callback
          )
        })

        it('should callback with error', function () {
          expect(this.callback.calledWith('error')).to.equal(true)
        })
      })
    })
  })

  describe('getV1DocInfo', function () {
    beforeEach(function () {
      this.callback = sinon.stub()
    })

    describe('when v1 api not set', function () {
      beforeEach(function () {
        this.TokenAccessHandler.getV1DocInfo(
          this.token,
          this.v2UserId,
          this.callback
        )
      })

      it('should not check access and return default info', function () {
        expect(this.V1Api.request.called).to.equal(false)
        expect(
          this.callback.calledWith(null, {
            exists: true,
            exported: false,
          })
        ).to.equal(true)
      })
    })

    describe('when v1 api is set', function () {
      beforeEach(function () {
        this.settings.apis = { v1: 'v1' }
      })

      describe('on V1Api.request success', function () {
        beforeEach(function () {
          this.V1Api.request = sinon
            .stub()
            .callsArgWith(1, null, null, 'mock-data')
          this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should return response body', function () {
          expect(
            this.V1Api.request.calledWith({
              url: `/api/v1/overleaf/docs/${this.token}/info`,
            })
          ).to.equal(true)
          expect(this.callback.calledWith(null, 'mock-data')).to.equal(true)
        })
      })

      describe('on V1Api.request error', function () {
        beforeEach(function () {
          this.V1Api.request = sinon.stub().callsArgWith(1, 'error')
          this.TokenAccessHandler.getV1DocInfo(
            this.token,
            this.v2UserId,
            this.callback
          )
        })

        it('should callback with error', function () {
          expect(this.callback.calledWith('error')).to.equal(true)
        })
      })
    })
  })

  describe('createTokenHashPrefix', function () {
    it('creates a prefix of the hash', function () {
      const prefix =
        this.TokenAccessHandler.createTokenHashPrefix('zxpxjrwdtsgd')
      expect(prefix.length).to.equal(6)
    })
  })

  describe('normalizeTokenHashPrefix', function () {
    const cases = {
      // hex string
      ab2345: 'ab2345',
      '01234f': '01234f',
      '012345': '012345',
      // remove (encoded) hash
      '#012345': '012345',
      '%23012345': '012345',
      // remove trailing special characters
      '012345.': '012345',
      '012345/': '012345',
      // v1 doc
      '%2F1234567%2F': '%2F1234567%2F',
    }
    for (const [input, output] of Object.entries(cases)) {
      it(`should handle ${JSON.stringify(input)}`, function () {
        expect(
          this.TokenAccessHandler.normalizeTokenHashPrefix(input)
        ).to.equal(output)
      })
    }
  })

  describe('checkTokenHashPrefix', function () {
    const userId = 'abc123'
    const projectId = 'def456'
    it('sends "match" to metrics when prefix matches the prefix of the hash of the token', function () {
      const token = 'zxpxjrwdtsgd'
      const prefix = this.TokenAccessHandler.createTokenHashPrefix(token)

      this.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'match',
        }
      )
    })
    it('sends "mismatch" to metrics when prefix does not match the prefix of the hash of the token', function () {
      const token = 'zxpxjrwdtsgd'
      const prefix = this.TokenAccessHandler.createTokenHashPrefix(token)
      this.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        `#${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'mismatch',
        }
      )
      expect(this.logger.info).to.have.been.calledWith(
        {
          tokenHashPrefix: prefix,
          hashPrefixStatus: 'mismatch',
          userId,
          projectId,
          type: 'readOnly',
        },
        'mismatched token hash prefix'
      )
    })
    it('sends "missing" to metrics when prefix is undefined', function () {
      this.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        undefined,
        'readOnly',
        userId,
        { projectId }
      )

      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'missing',
        }
      )
    })
    it('sends "missing" to metrics when URL hash is sent as "#" only', function () {
      this.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        '#',
        'readOnly',
        userId,
        { projectId }
      )

      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'missing',
        }
      )
    })
    it('handles encoded hashtags', function () {
      const token = 'zxpxjrwdtsgd'
      const prefix = this.TokenAccessHandler.createTokenHashPrefix(token)

      this.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `%23${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'match',
        }
      )
    })

    it('sends "mismatch-v1-format" for suspected v1 URLs with 7 numbers in URL fragment', function () {
      const token = '4112142489ddsbkrdzhxrq'
      const prefix = '%2F1234567%2F'
      this.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readAndWrite',
        userId,
        { projectId }
      )
      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readAndWrite',
          status: 'mismatch-v1-format',
        }
      )
    })
    it('sends "mismatch-v1-format" for suspected v1 URLs with 8 numbers in URL fragment', function () {
      const token = '4112142489ddsbkrdzhxrq'
      const prefix = '%2F12345678%2F'
      this.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readAndWrite',
        userId,
        { projectId }
      )
      expect(this.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readAndWrite',
          status: 'mismatch-v1-format',
        }
      )
    })
  })
})
