import { beforeEach, describe, expect, it, vi } from 'vitest'
import mongodb from 'mongodb-legacy'
import path from 'node:path'
import sinon from 'sinon'

const { ObjectId } = mongodb

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.mjs'
)

const projectId = 'project_id_here'
const userId = new ObjectId()
const readOnlyRef = new ObjectId()
const collaberatorRef = new ObjectId()
const projectName = 'project_name_here'

const thirdPartyDataStoreApiUrl = 'http://third-party-json-store.herokuapp.com'
const siteUrl = 'http://127.0.0.1:3000'
const filestoreUrl = 'filestore.overleaf.com'
const projectHistoryUrl = 'http://project-history:3054'

describe('TpdsUpdateSender', function () {
  beforeEach(async function (ctx) {
    ctx.fakeUser = {
      _id: '12390i',
    }
    ctx.memberIds = [userId, collaberatorRef, readOnlyRef]
    ctx.enqueueUrl = new URL(
      'http://tpdsworker/enqueue/web_to_tpds_http_requests'
    )

    ctx.CollaboratorsGetter = {
      promises: {
        getInvitedMemberIds: sinon.stub().resolves(ctx.memberIds),
      },
    }
    ctx.docstoreUrl = 'docstore.overleaf.env'
    ctx.response = {
      ok: true,
      json: sinon.stub(),
    }
    ctx.FetchUtils = {
      fetchNothing: sinon.stub().resolves(),
    }
    ctx.settings = {
      siteUrl,
      apis: {
        thirdPartyDataStore: { url: thirdPartyDataStoreApiUrl },
        filestore: {
          url: filestoreUrl,
        },
        docstore: {
          pubUrl: ctx.docstoreUrl,
        },
        project_history: {
          url: projectHistoryUrl,
        },
      },
    }
    const getUsers = sinon.stub()
    getUsers
      .withArgs({
        _id: {
          $in: ctx.memberIds,
        },
        'dropbox.access_token.uid': { $ne: null },
      })
      .resolves(
        ctx.memberIds.map(userId => {
          return { _id: userId }
        })
      )
    ctx.UserGetter = {
      promises: { getUsers },
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock('../../../../app/src/Features/User/UserGetter.mjs', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc() {},
      },
    }))

    ctx.TpdsUpdateSender = (await import(modulePath)).default
  })

  describe('enqueue', function () {
    it('should not call request if there is no tpdsworker url', async function (ctx) {
      await ctx.TpdsUpdateSender.promises.enqueue(null, null, null)
      ctx.FetchUtils.fetchNothing.should.not.have.been.called
    })

    it('should post the message to the tpdsworker', async function (ctx) {
      ctx.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
      const group0 = 'myproject'
      const method0 = 'somemethod0'
      const job0 = 'do something'
      await ctx.TpdsUpdateSender.promises.enqueue(group0, method0, job0)
      ctx.FetchUtils.fetchNothing.should.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          method: 'POST',
          json: { group: group0, job: job0, method: method0 },
        }
      )
    })
  })

  describe('sending updates', function () {
    beforeEach(function (ctx) {
      ctx.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
    })

    it('queues a post the file with user and file id and hash', async function (ctx) {
      const fileId = '4545345'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const historyId = 91525
      const path = '/some/path/here.jpg'

      await ctx.TpdsUpdateSender.promises.addFile({
        projectId,
        historyId,
        fileId,
        hash,
        path,
        projectName,
      })

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'pipeStreamFrom',
            job: {
              method: 'post',
              streamOrigin: `${projectHistoryUrl}/project/${historyId}/blob/${hash}`,
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {},
          },
        }
      )
    })

    it('post doc with stream origin of docstore', async function (ctx) {
      const docId = '4545345'
      const path = '/some/path/here.tex'
      const lines = ['line1', 'line2', 'line3']

      await ctx.TpdsUpdateSender.promises.addDoc({
        projectId,
        docId,
        path,
        docLines: lines,
        projectName,
      })

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'pipeStreamFrom',
            job: {
              method: 'post',
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              streamOrigin: `${ctx.docstoreUrl}/project/${projectId}/doc/${docId}/raw`,
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {
              headers: {},
            },
          },
        }
      )
    })

    it('deleting entity', async function (ctx) {
      const path = '/path/here/t.tex'
      const subtreeEntityIds = ['id1', 'id2']

      await ctx.TpdsUpdateSender.promises.deleteEntity({
        projectId,
        path,
        projectName,
        subtreeEntityIds,
      })

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'standardHttpRequest',
            job: {
              method: 'delete',
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              headers: {},
              json: { subtreeEntityIds },
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {
              headers: {},
            },
          },
        }
      )
    })

    it('moving entity', async function (ctx) {
      const startPath = 'staring/here/file.tex'
      const endPath = 'ending/here/file.tex'

      await ctx.TpdsUpdateSender.promises.moveEntity({
        projectId,
        startPath,
        endPath,
        projectName,
      })

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'standardHttpRequest',
            job: {
              method: 'put',
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`,
              json: {
                startPath: `/${projectName}/${startPath}`,
                endPath: `/${projectName}/${endPath}`,
              },
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {
              headers: {},
            },
          },
        }
      )
    })

    it('should be able to rename a project using the move entity func', async function (ctx) {
      const oldProjectName = '/oldProjectName/'
      const newProjectName = '/newProjectName/'

      await ctx.TpdsUpdateSender.promises.moveEntity({
        projectId,
        projectName: oldProjectName,
        newProjectName,
      })

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'standardHttpRequest',
            job: {
              method: 'put',
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity`,
              json: {
                startPath: oldProjectName,
                endPath: newProjectName,
              },
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {
              headers: {},
            },
          },
        }
      )
    })

    it('pollDropboxForUser', async function (ctx) {
      await ctx.TpdsUpdateSender.promises.pollDropboxForUser(userId)

      expect(ctx.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        ctx.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'standardHttpRequest',
            job: {
              method: 'post',
              uri: `${thirdPartyDataStoreApiUrl}/user/poll`,
              json: {
                user_ids: [userId],
              },
            },
          },
        }
      )
    })
  })

  describe('user not linked to dropbox', function () {
    beforeEach(function (ctx) {
      ctx.UserGetter.promises.getUsers
        .withArgs({
          _id: {
            $in: ctx.memberIds,
          },
          'dropbox.access_token.uid': { $ne: null },
        })
        .resolves([])
    })

    it('does not make request to tpds', async function (ctx) {
      const fileId = '4545345'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const historyId = 91525
      const path = '/some/path/here.jpg'

      await ctx.TpdsUpdateSender.promises.addFile({
        projectId,
        historyId,
        hash,
        fileId,
        path,
        projectName,
      })
      ctx.FetchUtils.fetchNothing.should.not.have.been.called
    })
  })
})
