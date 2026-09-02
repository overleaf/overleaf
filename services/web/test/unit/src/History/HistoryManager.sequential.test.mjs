import { beforeAll, beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { RequestFailedError } from '@overleaf/fetch-utils'
import { FileTooLargeError } from '../../../../app/src/Features/Errors/Errors.js'
import {
  cleanupTestDatabase,
  db,
  waitForDb,
} from '../../../../app/src/infrastructure/mongodb.mjs'

const { ObjectId } = mongodb

// Ensure the module under test and this test file share the same
// FileTooLargeError class, so `instanceof` checks line up.
vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const MODULE_PATH = '../../../../app/src/Features/History/HistoryManager'

const GLOBAL_BLOBS = [
  'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391',
  '02426c2b3a484003ca42ed52b374b7907b757d12',
]

describe('HistoryManager', function () {
  beforeAll(async function () {
    await waitForDb()
  })
  beforeAll(cleanupTestDatabase)
  beforeAll(async function () {
    await db.projectHistoryGlobalBlobs.insertMany(
      GLOBAL_BLOBS.map(sha => ({
        _id: sha,
        byteLength: 0,
        stringLength: 0,
      }))
    )
  })

  beforeEach(async function (ctx) {
    ctx.user_id = 'user-id-123'
    ctx.historyId = new ObjectId().toString()
    ctx.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(ctx.user_id),
    }
    ctx.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchNothing: sinon.stub().resolves(),
      RequestFailedError,
    }
    ctx.projectHistoryUrl = 'http://project_history.example.com'
    ctx.v1HistoryUrl = 'http://v1_history.example.com'
    ctx.v1HistoryUser = 'system'
    ctx.v1HistoryPassword = 'verysecret'
    ctx.settings = {
      apis: {
        filestore: {
          url: 'http://filestore.example.com',
        },
        project_history: {
          url: ctx.projectHistoryUrl,
        },
        v1_history: {
          url: ctx.v1HistoryUrl,
          user: ctx.v1HistoryUser,
          pass: ctx.v1HistoryPassword,
          buckets: {
            globalBlobs: 'globalBlobs',
            projectBlobs: 'projectBlobs',
          },
        },
      },
    }

    ctx.UserGetter = {
      promises: {
        getUsersByV1Ids: sinon.stub(),
        getUsers: sinon.stub(),
      },
    }

    ctx.project = {
      overleaf: {
        history: {
          id: ctx.historyId,
        },
      },
    }

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }

    ctx.HistoryBackupDeletionHandler = {
      deleteProject: sinon.stub().resolves(),
    }

    vi.doMock('../../../../app/src/infrastructure/mongodb', () => ({
      ObjectId,
      db,
      waitForDb,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/History/HistoryBackupDeletionHandler',
      () => ({
        default: ctx.HistoryBackupDeletionHandler,
      })
    )

    ctx.HistoryManager = (await import(MODULE_PATH)).default
  })

  describe('getFilestoreBlobURL', function () {
    beforeEach(async function (ctx) {
      await ctx.HistoryManager.loadGlobalBlobsPromise
    })
    it('should return a global blob location', function (ctx) {
      for (const sha of GLOBAL_BLOBS) {
        expect(ctx.HistoryManager.getFilestoreBlobURL('42', sha)).to.equal(
          `${ctx.settings.apis.filestore.url}/history/global/hash/${sha}`
        )
      }
    })
    it('should return a project blob location for a v1 project', function (ctx) {
      const historyId = 42
      const sha = '6ddfa0578a67fe5ad6623a8665ec9aafce1eb5ca'
      expect(ctx.HistoryManager.getFilestoreBlobURL(historyId, sha)).to.equal(
        `${ctx.settings.apis.filestore.url}/history/project/${historyId}/hash/${sha}`
      )
    })
    it('should return a project blob location for a mongo project', function (ctx) {
      const historyId = '424242424242424242424242'
      const sha = '6ddfa0578a67fe5ad6623a8665ec9aafce1eb5ca'
      expect(ctx.HistoryManager.getFilestoreBlobURL(historyId, sha)).to.equal(
        `${ctx.settings.apis.filestore.url}/history/project/${historyId}/hash/${sha}`
      )
    })
  })

  describe('initializeProject', function () {
    beforeEach(function (ctx) {
      ctx.settings.apis.project_history.initializeHistoryForNewProjects = true
    })

    describe('project history returns a successful response', function () {
      beforeEach(async function (ctx) {
        ctx.FetchUtils.fetchJson.resolves({ project: { id: ctx.historyId } })
        ctx.result = await ctx.HistoryManager.promises.initializeProject(
          ctx.historyId
        )
      })

      it('should call the project history api', function (ctx) {
        ctx.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          `${ctx.settings.apis.project_history.url}/project`,
          { method: 'POST' }
        )
      })

      it('should return the overleaf id', function (ctx) {
        expect(ctx.result).to.equal(ctx.historyId)
      })
    })

    describe('project history returns a response without the project id', function () {
      it('should throw an error', async function (ctx) {
        ctx.FetchUtils.fetchJson.resolves({ project: {} })
        await expect(
          ctx.HistoryManager.promises.initializeProject(ctx.historyId)
        ).to.be.rejected
      })
    })

    describe('project history errors', function () {
      it('should propagate the error', async function (ctx) {
        ctx.FetchUtils.fetchJson.rejects(new Error('problem connecting'))
        await expect(
          ctx.HistoryManager.promises.initializeProject(ctx.historyId)
        ).to.be.rejected
      })
    })
  })

  describe('injectUserDetails', function () {
    beforeEach(function (ctx) {
      ctx.user1 = {
        _id: (ctx.user_id1 = '123456'),
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        overleaf: { id: 5011 },
      }
      ctx.user1_view = {
        id: ctx.user_id1,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      }
      ctx.user2 = {
        _id: (ctx.user_id2 = 'abcdef'),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }
      ctx.user2_view = {
        id: ctx.user_id2,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }
      ctx.UserGetter.promises.getUsersByV1Ids.resolves([ctx.user1])
      ctx.UserGetter.promises.getUsers.resolves([ctx.user1, ctx.user2])
    })

    describe('with a diff', function () {
      it('should turn user_ids into user objects', async function (ctx) {
        const diff = await ctx.HistoryManager.promises.injectUserDetails({
          diff: [
            {
              i: 'foo',
              meta: {
                users: [ctx.user_id1],
              },
            },
            {
              i: 'bar',
              meta: {
                users: [ctx.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([ctx.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([ctx.user2_view])
      })

      it('should handle v1 user ids', async function (ctx) {
        const diff = await ctx.HistoryManager.promises.injectUserDetails({
          diff: [
            {
              i: 'foo',
              meta: {
                users: [5011],
              },
            },
            {
              i: 'bar',
              meta: {
                users: [ctx.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([ctx.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([ctx.user2_view])
      })

      it('should leave user objects', async function (ctx) {
        const diff = await ctx.HistoryManager.promises.injectUserDetails({
          diff: [
            {
              i: 'foo',
              meta: {
                users: [ctx.user1_view],
              },
            },
            {
              i: 'bar',
              meta: {
                users: [ctx.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([ctx.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([ctx.user2_view])
      })

      it('should handle a binary diff marker', async function (ctx) {
        const diff = await ctx.HistoryManager.promises.injectUserDetails({
          diff: { binary: true },
        })
        expect(diff.diff.binary).to.be.true
      })
    })

    describe('with a list of updates', function () {
      it('should turn user_ids into user objects', async function (ctx) {
        const updates = await ctx.HistoryManager.promises.injectUserDetails({
          updates: [
            {
              fromV: 5,
              toV: 8,
              meta: {
                users: [ctx.user_id1],
              },
            },
            {
              fromV: 4,
              toV: 5,
              meta: {
                users: [ctx.user_id2],
              },
            },
          ],
        })
        expect(updates.updates[0].meta.users).to.deep.equal([ctx.user1_view])
        expect(updates.updates[1].meta.users).to.deep.equal([ctx.user2_view])
      })

      it('should leave user objects', async function (ctx) {
        const updates = await ctx.HistoryManager.promises.injectUserDetails({
          updates: [
            {
              fromV: 5,
              toV: 8,
              meta: {
                users: [ctx.user1_view],
              },
            },
            {
              fromV: 4,
              toV: 5,
              meta: {
                users: [ctx.user_id2],
              },
            },
          ],
        })
        expect(updates.updates[0].meta.users).to.deep.equal([ctx.user1_view])
        expect(updates.updates[1].meta.users).to.deep.equal([ctx.user2_view])
      })
    })
  })

  describe('copyBlob', function () {
    const sourceHistoryId = 'source-history-id'
    const targetHistoryId = 'target-history-id'
    const hash = 'abcdef0123456789abcdef0123456789abcdef01'

    it('should call the v1-history service without a size limit', async function (ctx) {
      await ctx.HistoryManager.promises.copyBlob(
        sourceHistoryId,
        targetHistoryId,
        hash
      )
      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledOnce
      const [url, opts] = ctx.FetchUtils.fetchNothing.getCall(0).args
      expect(url.toString()).to.equal(
        `${ctx.v1HistoryUrl}/projects/${targetHistoryId}/blobs/${hash}?copyFrom=${sourceHistoryId}`
      )
      expect(opts).to.deep.equal({
        method: 'POST',
        basicAuth: {
          user: ctx.v1HistoryUser,
          password: ctx.v1HistoryPassword,
        },
      })
    })

    it('should pass the size limit as a query parameter', async function (ctx) {
      await ctx.HistoryManager.promises.copyBlob(
        sourceHistoryId,
        targetHistoryId,
        hash,
        1234
      )
      const [url] = ctx.FetchUtils.fetchNothing.getCall(0).args
      expect(url.searchParams.get('copyFrom')).to.equal(sourceHistoryId)
      expect(url.searchParams.get('sizeLimit')).to.equal('1234')
    })

    it('should throw a FileTooLargeError with the size on a 413 response', async function (ctx) {
      ctx.FetchUtils.fetchNothing.rejects(
        new RequestFailedError(
          `${ctx.v1HistoryUrl}/projects/${targetHistoryId}/blobs/${hash}`,
          { method: 'POST' },
          { status: 413 },
          JSON.stringify({ size: 9000 })
        )
      )
      await expect(
        ctx.HistoryManager.promises.copyBlob(
          sourceHistoryId,
          targetHistoryId,
          hash,
          1234
        )
      ).to.be.rejected.then(err => {
        expect(err).to.be.instanceof(FileTooLargeError)
        expect(err.info.size).to.equal(9000)
      })
    })

    it('should throw a FileTooLargeError even if the 413 body is not valid JSON', async function (ctx) {
      ctx.FetchUtils.fetchNothing.rejects(
        new RequestFailedError(
          `${ctx.v1HistoryUrl}/projects/${targetHistoryId}/blobs/${hash}`,
          { method: 'POST' },
          { status: 413 },
          'not json'
        )
      )
      await expect(
        ctx.HistoryManager.promises.copyBlob(
          sourceHistoryId,
          targetHistoryId,
          hash,
          1234
        )
      ).to.be.rejected.then(err => {
        expect(err).to.be.instanceof(FileTooLargeError)
        expect(err.info.size).to.be.undefined
      })
    })

    it('should rethrow non-413 request failures', async function (ctx) {
      const err = new RequestFailedError(
        `${ctx.v1HistoryUrl}/projects/${targetHistoryId}/blobs/${hash}`,
        { method: 'POST' },
        { status: 500 },
        ''
      )
      ctx.FetchUtils.fetchNothing.rejects(err)
      await expect(
        ctx.HistoryManager.promises.copyBlob(
          sourceHistoryId,
          targetHistoryId,
          hash,
          1234
        )
      ).to.be.rejectedWith(err)
    })
  })

  describe('deleteProject', function () {
    const projectId = new ObjectId()
    const historyId = new ObjectId()

    beforeEach(async function (ctx) {
      await ctx.HistoryManager.promises.deleteProject(projectId, historyId)
    })

    it('should call the project-history service', async function (ctx) {
      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWith(
        `${ctx.projectHistoryUrl}/project/${projectId}`,
        { method: 'DELETE', signal: sinon.match.instanceOf(AbortSignal) }
      )
    })

    it('should call the v1-history service', async function (ctx) {
      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWith(
        `${ctx.v1HistoryUrl}/projects/${historyId}`,
        {
          method: 'DELETE',
          basicAuth: {
            user: ctx.v1HistoryUser,
            password: ctx.v1HistoryPassword,
          },
          signal: sinon.match.instanceOf(AbortSignal),
        }
      )
    })

    it('should call the history-backup-deletion service', async function (ctx) {
      expect(
        ctx.HistoryBackupDeletionHandler.deleteProject
      ).to.have.been.calledWith(projectId)
    })
  })
})
