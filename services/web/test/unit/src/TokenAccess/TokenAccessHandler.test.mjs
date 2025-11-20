import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import PrivilegeLevels from '../../../../app/src/Features/Authorization/PrivilegeLevels.mjs'

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/TokenAccess/TokenAccessHandler'
)

vi.mock('node:crypto', async () => {
  const originalModule = await vi.importActual('node:crypto')
  return {
    default: {
      ...originalModule,
      timingSafeEqual: vi.fn(originalModule.default.timingSafeEqual),
    },
  }
})

const { ObjectId } = mongodb

describe('TokenAccessHandler', function () {
  beforeEach(async function (ctx) {
    ctx.token = 'abcdefabcdef'
    ctx.projectId = new ObjectId()
    ctx.project = {
      _id: ctx.projectId,
      publicAccesLevel: 'tokenBased',
      owner_ref: new ObjectId(),
    }
    ctx.userId = new ObjectId()
    ctx.req = {}

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: (ctx.Project = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = { inc: sinon.stub() }),
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = { disableLinkSharing: false }),
    }))

    vi.doMock('../../../../app/src/Features/V1/V1Api', () => ({
      default: (ctx.V1Api = {
        promises: {
          request: sinon.stub(),
        },
      }),
    }))

    ctx.Crypto = (await vi.importMock('node:crypto')).default

    vi.doMock(
      '../../../../app/src/Features/Analytics/AnalyticsManager',
      () => ({
        default: (ctx.Analytics = {
          recordEventForUserInBackground: sinon.stub(),
        }),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: (ctx.Features = {}),
    }))

    ctx.TokenAccessHandler = (await import(modulePath)).default
  })

  describe('when link sharing is enabled', function () {
    beforeEach(function (ctx) {
      ctx.Features.hasFeature = sinon
        .stub()
        .withArgs('link-sharing')
        .returns(true)
    })
    describe('getTokenType', function () {
      it('should determine tokens correctly', function (ctx) {
        const specs = {
          abcdefabcdef: 'readOnly',
          aaaaaabbbbbb: 'readOnly',
          '54325aaaaaa': 'readAndWrite',
          '54325aaaaaabbbbbb': 'readAndWrite',
          '': null,
          abc123def: null,
        }
        for (const token of Object.keys(specs)) {
          expect(ctx.TokenAccessHandler.getTokenType(token)).to.equal(
            specs[token]
          )
        }
      })
    })

    describe('getProjectByReadOnlyToken', function () {
      beforeEach(function (ctx) {
        ctx.token = 'abcdefabcdef'
        ctx.Project.findOne = sinon.stub().returns({
          exec: sinon.stub().resolves(ctx.project),
        })
      })

      it('should get the project', async function (ctx) {
        const project =
          await ctx.TokenAccessHandler.promises.getProjectByReadOnlyToken(
            ctx.token
          )
        expect(project).to.exist
        expect(ctx.Project.findOne.callCount).to.equal(1)
      })
    })

    describe('getProjectByReadAndWriteToken', function () {
      beforeEach(function (ctx) {
        ctx.token = '1234abcdefabcdef'
        ctx.project.tokens = {
          readAndWrite: ctx.token,
          readAndWritePrefix: '1234',
        }
        ctx.Project.findOne = sinon.stub().returns({
          exec: sinon.stub().resolves(ctx.project),
        })
      })

      it('should get the project and do timing-safe comparison', async function (ctx) {
        const project =
          await ctx.TokenAccessHandler.promises.getProjectByReadAndWriteToken(
            ctx.token
          )
        expect(project).to.exist
        expect(ctx.Crypto.timingSafeEqual).toHaveBeenCalledTimes(1)
        expect(
          ctx.Crypto.timingSafeEqual.mock.calls[0][0].equals(
            Buffer.from(ctx.token)
          )
        ).toBeTruthy()
        expect(ctx.Project.findOne.callCount).to.equal(1)
      })
    })

    describe('addReadOnlyUserToProject', function () {
      beforeEach(function (ctx) {
        ctx.Project.updateOne = sinon.stub().returns({
          exec: sinon.stub().resolves(null),
        })
      })

      it('should call Project.updateOne', async function (ctx) {
        await ctx.TokenAccessHandler.promises.addReadOnlyUserToProject(
          ctx.userId,
          ctx.projectId,
          ctx.project.owner_ref
        )
        expect(ctx.Project.updateOne.callCount).to.equal(1)
        expect(
          ctx.Project.updateOne.calledWith({
            _id: ctx.projectId,
          })
        ).to.equal(true)
        expect(ctx.Project.updateOne.lastCall.args[1].$addToSet).to.have.keys(
          'tokenAccessReadOnly_refs'
        )
        sinon.assert.calledWith(
          ctx.Analytics.recordEventForUserInBackground,
          ctx.userId,
          'project-joined',
          {
            mode: 'view',
            role: PrivilegeLevels.READ_ONLY,
            projectId: ctx.projectId.toString(),
            ownerId: ctx.project.owner_ref.toString(),
            source: 'link-sharing',
          }
        )
      })

      describe('when Project.updateOne produces an error', function () {
        beforeEach(function (ctx) {
          ctx.Project.updateOne = sinon
            .stub()
            .returns({ exec: sinon.stub().rejects(new Error('woops')) })
        })

        it('should be rejected', async function (ctx) {
          await expect(
            ctx.TokenAccessHandler.promises.addReadOnlyUserToProject(
              ctx.userId,
              ctx.projectId
            )
          ).to.be.rejected
        })
      })
    })

    describe('removeReadAndWriteUserFromProject', function () {
      beforeEach(function (ctx) {
        ctx.Project.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(null) })
      })

      it('should call Project.updateOne', async function (ctx) {
        await ctx.TokenAccessHandler.promises.removeReadAndWriteUserFromProject(
          ctx.userId,
          ctx.projectId
        )

        expect(ctx.Project.updateOne.callCount).to.equal(1)
        expect(
          ctx.Project.updateOne.calledWith({
            _id: ctx.projectId,
          })
        ).to.equal(true)
        expect(ctx.Project.updateOne.lastCall.args[1].$pull).to.have.keys(
          'tokenAccessReadAndWrite_refs'
        )
      })
    })

    describe('moveReadAndWriteUserToReadOnly', function () {
      beforeEach(function (ctx) {
        ctx.Project.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves(null) })
      })

      it('should call Project.updateOne', async function (ctx) {
        await ctx.TokenAccessHandler.promises.moveReadAndWriteUserToReadOnly(
          ctx.userId,
          ctx.projectId
        )

        expect(ctx.Project.updateOne.callCount).to.equal(1)
        expect(
          ctx.Project.updateOne.calledWith({
            _id: ctx.projectId,
          })
        ).to.equal(true)
        expect(ctx.Project.updateOne.lastCall.args[1].$pull).to.have.keys(
          'tokenAccessReadAndWrite_refs'
        )
        expect(ctx.Project.updateOne.lastCall.args[1].$addToSet).to.have.keys(
          'tokenAccessReadOnly_refs'
        )
      })
    })

    describe('grantSessionTokenAccess', function () {
      beforeEach(function (ctx) {
        ctx.req = { session: {}, headers: {} }
      })

      it('should add the token to the session', function (ctx) {
        ctx.TokenAccessHandler.promises.grantSessionTokenAccess(
          ctx.req,
          ctx.projectId,
          ctx.token
        )
        expect(
          ctx.req.session.anonTokenAccess[ctx.projectId.toString()]
        ).to.equal(ctx.token)
      })
    })

    describe('validateTokenForAnonymousAccess', function () {
      describe('when a read-only project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.getTokenType = sinon.stub().returns('readOnly')
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(ctx.project)
        })

        it('should try to find projects with both kinds of token', async function (ctx) {
          await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
            ctx.projectId,
            ctx.token
          )

          expect(
            ctx.TokenAccessHandler.promises.getProjectByToken.callCount
          ).to.equal(1)
        })

        it('should allow read-only access', async function (ctx) {
          const { isValidReadAndWrite, isValidReadOnly } =
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

          expect(isValidReadAndWrite).to.equal(false)
          expect(isValidReadOnly).to.equal(true)
        })
      })

      describe('when a read-and-write project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.promises.getTokenType = sinon
            .stub()
            .returns('readAndWrite')
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(ctx.project)
        })

        describe('when Anonymous token access is not enabled', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
          })

          it('should try to find projects with both kinds of token', async function (ctx) {
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

            expect(
              ctx.TokenAccessHandler.promises.getProjectByToken.callCount
            ).to.equal(1)
          })

          it('should not allow read-and-write access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })

        describe('when anonymous token access is enabled', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.promises.ANONYMOUS_READ_AND_WRITE_ENABLED = true
          })

          it('should try to find projects with both kinds of token', async function (ctx) {
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

            expect(
              ctx.TokenAccessHandler.promises.getProjectByToken.callCount
            ).to.equal(1)
          })

          it('should allow read-and-write access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(true)
            expect(isValidReadOnly).to.equal(false)
          })
        })
      })

      describe('when no project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(null)
        })

        it('should try to find projects with both kinds of token', async function (ctx) {
          await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
            ctx.projectId,
            ctx.token
          )

          expect(
            ctx.TokenAccessHandler.promises.getProjectByToken.callCount
          ).to.equal(1)
        })

        it('should not allow any access', async function (ctx) {
          const { isValidReadAndWrite, isValidReadOnly } =
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

          expect(isValidReadAndWrite).to.equal(false)
          expect(isValidReadOnly).to.equal(false)
        })
      })

      describe('when findProject produces an error', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .rejects(new Error('woops'))
        })

        it('should try to find projects with both kinds of token', async function (ctx) {
          await expect(
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )
          ).to.be.rejected

          expect(
            ctx.TokenAccessHandler.promises.getProjectByToken.callCount
          ).to.equal(1)
        })

        it('should produce an error and not allow access', async function (ctx) {
          await expect(
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )
          ).to.be.rejected
        })
      })

      describe('when project is not set to token-based access', function () {
        beforeEach(function (ctx) {
          ctx.project.publicAccesLevel = 'private'
        })

        describe('for read-and-write project', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.getTokenType = sinon
              .stub()
              .returns('readAndWrite')
            ctx.TokenAccessHandler.promises.getProjectByToken = sinon
              .stub()
              .resolves(ctx.project)
          })

          it('should not allow any access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })

        describe('for read-only project', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.getTokenType = sinon
              .stub()
              .returns('readOnly')
            ctx.TokenAccessHandler.promises.getProjectByToken = sinon
              .stub()
              .resolves(ctx.project)
          })

          it('should not allow any access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })

        describe('with nothing', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.promises.getProjectByToken = sinon
              .stub()
              .resolves(null)
          })

          it('should not allow any access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })
      })
    })
  })

  describe('when link sharing is disabled', function () {
    beforeEach(function (ctx) {
      ctx.Features.hasFeature = sinon
        .stub()
        .withArgs('link-sharing')
        .returns(false)
    })

    describe('addReadOnlyUserToProject', function () {
      beforeEach(function (ctx) {
        ctx.Project.updateOne = sinon.stub().returns({
          exec: sinon.stub().resolves(null),
        })
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.TokenAccessHandler.promises.addReadOnlyUserToProject(
            ctx.userId,
            ctx.projectId,
            ctx.project.owner_ref
          )
        ).to.be.rejectedWith('link sharing is disabled')
        expect(ctx.Project.updateOne.callCount).to.equal(0)
      })
    })

    describe('grantSessionTokenAccess', function () {
      beforeEach(function (ctx) {
        ctx.req = { session: {}, headers: {} }
      })

      it('should throw an error', function (ctx) {
        expect(() => {
          ctx.TokenAccessHandler.promises.grantSessionTokenAccess(
            ctx.req,
            ctx.projectId,
            ctx.token
          )
        }).to.throw('link sharing is disabled')
        expect(ctx.req.session.anonTokenAccess).to.be.undefined
      })
    })

    describe('validateTokenForAnonymousAccess', function () {
      describe('when a read-only project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.getTokenType = sinon.stub().returns('readOnly')
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(ctx.project)
        })

        it('should refuse access', async function (ctx) {
          const { isValidReadAndWrite, isValidReadOnly } =
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

          expect(isValidReadAndWrite).to.equal(false)
          expect(isValidReadOnly).to.equal(false)
        })
      })

      describe('when a read-and-write project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.promises.getTokenType = sinon
            .stub()
            .returns('readAndWrite')
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(ctx.project)
        })

        describe('when Anonymous token access is not enabled', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.ANONYMOUS_READ_AND_WRITE_ENABLED = false
          })

          it('should refuse access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })

        describe('when anonymous token access is enabled', function () {
          beforeEach(function (ctx) {
            ctx.TokenAccessHandler.promises.ANONYMOUS_READ_AND_WRITE_ENABLED = true
          })

          it('should not try to find any projects', async function (ctx) {
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

            expect(
              ctx.TokenAccessHandler.promises.getProjectByToken.callCount
            ).to.equal(0)
          })

          it('should refuse access', async function (ctx) {
            const { isValidReadAndWrite, isValidReadOnly } =
              await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
                ctx.projectId,
                ctx.token
              )

            expect(isValidReadAndWrite).to.equal(false)
            expect(isValidReadOnly).to.equal(false)
          })
        })
      })

      describe('when no project is found', function () {
        beforeEach(function (ctx) {
          ctx.TokenAccessHandler.promises.getProjectByToken = sinon
            .stub()
            .resolves(null)
        })

        it('should not try to find any projects ', async function (ctx) {
          await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
            ctx.projectId,
            ctx.token
          )

          expect(
            ctx.TokenAccessHandler.promises.getProjectByToken.callCount
          ).to.equal(0)
        })

        it('should not allow any access', async function (ctx) {
          const { isValidReadAndWrite, isValidReadOnly } =
            await ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess(
              ctx.projectId,
              ctx.token
            )

          expect(isValidReadAndWrite).to.equal(false)
          expect(isValidReadOnly).to.equal(false)
        })
      })
    })
  })

  describe('getDocPublishedInfo', function () {
    describe('when v1 api not set', function () {
      beforeEach(function (ctx) {
        ctx.settings.apis = { v1: undefined }
      })

      it('should not check access and return default info', async function (ctx) {
        const info =
          await ctx.TokenAccessHandler.promises.getV1DocPublishedInfo(ctx.token)

        expect(ctx.V1Api.promises.request.called).to.equal(false)
        expect(info).to.deep.equal({
          allow: true,
        })
      })
    })

    describe('when v1 api is set', function () {
      beforeEach(function (ctx) {
        ctx.settings.apis = { v1: { url: 'v1Url' } }
      })

      describe('on V1Api.request success', function () {
        beforeEach(function (ctx) {
          ctx.V1Api.promises.request = sinon
            .stub()
            .resolves({ body: 'mock-data' })
        })

        it('should return response body', async function (ctx) {
          const info =
            await ctx.TokenAccessHandler.promises.getV1DocPublishedInfo(
              ctx.token
            )

          expect(
            ctx.V1Api.promises.request.calledWith({
              url: `/api/v1/overleaf/docs/${ctx.token}/is_published`,
            })
          ).to.equal(true)
          expect(info).to.equal('mock-data')
        })
      })

      describe('on V1Api.request error', function () {
        beforeEach(function (ctx) {
          ctx.V1Api.promises.request = sinon.stub().rejects('error')
        })

        it('should be rejected', async function (ctx) {
          await expect(
            ctx.TokenAccessHandler.promises.getV1DocPublishedInfo(ctx.token)
          ).to.be.rejected
        })
      })
    })
  })

  describe('getV1DocInfo', function () {
    describe('when v1 api not set', function () {
      it('should not check access and return default info', async function (ctx) {
        const info = await ctx.TokenAccessHandler.promises.getV1DocInfo(
          ctx.token,
          ctx.v2UserId
        )

        expect(ctx.V1Api.promises.request.called).to.equal(false)
        expect(info).to.deep.equal({
          exists: true,
          exported: false,
        })
      })
    })

    describe('when v1 api is set', function () {
      beforeEach(function (ctx) {
        ctx.settings.apis = { v1: 'v1' }
      })

      describe('on V1Api.request success', function () {
        beforeEach(function (ctx) {
          ctx.V1Api.promises.request = sinon
            .stub()
            .resolves({ body: 'mock-data' })
        })

        it('should return response body', async function (ctx) {
          const info = await ctx.TokenAccessHandler.promises.getV1DocInfo(
            ctx.token,
            ctx.v2UserId
          )

          expect(
            ctx.V1Api.promises.request.calledWith({
              url: `/api/v1/overleaf/docs/${ctx.token}/info`,
            })
          ).to.equal(true)
          expect(info).to.equal('mock-data')
        })
      })

      describe('on V1Api.request error', function () {
        beforeEach(function (ctx) {
          ctx.V1Api.promises.request = sinon.stub().rejects('error')
        })

        it('should be rejected', async function (ctx) {
          await expect(
            ctx.TokenAccessHandler.promises.getV1DocInfo(
              ctx.token,
              ctx.v2UserId
            )
          ).to.be.rejected
        })
      })
    })
  })

  describe('createTokenHashPrefix', function () {
    it('creates a prefix of the hash', function (ctx) {
      const prefix =
        ctx.TokenAccessHandler.createTokenHashPrefix('zxpxjrwdtsgd')
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
      it(`should handle ${JSON.stringify(input)}`, function (ctx) {
        expect(ctx.TokenAccessHandler.normalizeTokenHashPrefix(input)).to.equal(
          output
        )
      })
    }
  })

  describe('checkTokenHashPrefix', function () {
    const userId = 'abc123'
    const projectId = 'def456'
    it('sends "match" to metrics when prefix matches the prefix of the hash of the token', function (ctx) {
      const token = 'zxpxjrwdtsgd'
      const prefix = ctx.TokenAccessHandler.createTokenHashPrefix(token)

      ctx.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'match',
        }
      )
    })
    it('sends "mismatch" to metrics when prefix does not match the prefix of the hash of the token', function (ctx) {
      const token = 'zxpxjrwdtsgd'
      const prefix = ctx.TokenAccessHandler.createTokenHashPrefix(token)
      ctx.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        `#${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'mismatch',
        }
      )
      expect(ctx.logger.info).toHaveBeenCalledWith(
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
    it('sends "missing" to metrics when prefix is undefined', function (ctx) {
      ctx.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        undefined,
        'readOnly',
        userId,
        { projectId }
      )

      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'missing',
        }
      )
    })
    it('sends "missing" to metrics when URL hash is sent as "#" only', function (ctx) {
      ctx.TokenAccessHandler.checkTokenHashPrefix(
        'anothertoken',
        '#',
        'readOnly',
        userId,
        { projectId }
      )

      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'missing',
        }
      )
    })
    it('handles encoded hashtags', function (ctx) {
      const token = 'zxpxjrwdtsgd'
      const prefix = ctx.TokenAccessHandler.createTokenHashPrefix(token)

      ctx.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `%23${prefix}`,
        'readOnly',
        userId,
        { projectId }
      )

      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readOnly',
          status: 'match',
        }
      )
    })

    it('sends "mismatch-v1-format" for suspected v1 URLs with 7 numbers in URL fragment', function (ctx) {
      const token = '4112142489ddsbkrdzhxrq'
      const prefix = '%2F1234567%2F'
      ctx.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readAndWrite',
        userId,
        { projectId }
      )
      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readAndWrite',
          status: 'mismatch-v1-format',
        }
      )
    })
    it('sends "mismatch-v1-format" for suspected v1 URLs with 8 numbers in URL fragment', function (ctx) {
      const token = '4112142489ddsbkrdzhxrq'
      const prefix = '%2F12345678%2F'
      ctx.TokenAccessHandler.checkTokenHashPrefix(
        token,
        `#${prefix}`,
        'readAndWrite',
        userId,
        { projectId }
      )
      expect(ctx.Metrics.inc).to.have.been.calledWith(
        'link-sharing.hash-check',
        {
          path: 'readAndWrite',
          status: 'mismatch-v1-format',
        }
      )
    })
  })
})
