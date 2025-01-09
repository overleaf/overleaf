const { ObjectId } = require('mongodb-legacy')
const SandboxedModule = require('sandboxed-module')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')

const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender.js'
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
  beforeEach(function () {
    this.fakeUser = {
      _id: '12390i',
    }
    this.memberIds = [userId, collaberatorRef, readOnlyRef]
    this.enqueueUrl = new URL(
      'http://tpdsworker/enqueue/web_to_tpds_http_requests'
    )

    this.CollaboratorsGetter = {
      promises: {
        getInvitedMemberIds: sinon.stub().resolves(this.memberIds),
      },
    }
    this.docstoreUrl = 'docstore.overleaf.env'
    this.response = {
      ok: true,
      json: sinon.stub(),
    }
    this.FetchUtils = {
      fetchNothing: sinon.stub().resolves(),
    }
    this.settings = {
      siteUrl,
      apis: {
        thirdPartyDataStore: { url: thirdPartyDataStoreApiUrl },
        filestore: {
          url: filestoreUrl,
        },
        docstore: {
          pubUrl: this.docstoreUrl,
        },
        project_history: {
          url: projectHistoryUrl,
        },
      },
      enableProjectHistoryBlobs: true,
    }
    const getUsers = sinon.stub()
    getUsers
      .withArgs({
        _id: {
          $in: this.memberIds,
        },
        'dropbox.access_token.uid': { $ne: null },
      })
      .resolves(
        this.memberIds.map(userId => {
          return { _id: userId }
        })
      )
    this.UserGetter = {
      promises: { getUsers },
    }
    this.TpdsUpdateSender = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '@overleaf/settings': this.settings,
        '@overleaf/fetch-utils': this.FetchUtils,
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../User/UserGetter.js': this.UserGetter,
        '@overleaf/metrics': {
          inc() {},
        },
      },
    })
  })

  describe('enqueue', function () {
    it('should not call request if there is no tpdsworker url', async function () {
      await this.TpdsUpdateSender.promises.enqueue(null, null, null)
      this.FetchUtils.fetchNothing.should.not.have.been.called
    })

    it('should post the message to the tpdsworker', async function () {
      this.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
      const group0 = 'myproject'
      const method0 = 'somemethod0'
      const job0 = 'do something'
      await this.TpdsUpdateSender.promises.enqueue(group0, method0, job0)
      this.FetchUtils.fetchNothing.should.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          method: 'POST',
          json: { group: group0, job: job0, method: method0 },
        }
      )
    })
  })

  describe('sending updates', function () {
    beforeEach(function () {
      this.settings.apis.tpdsworker = { url: 'http://tpdsworker' }
    })

    it('queues a post the file with user and file id', async function () {
      const fileId = '4545345'
      const hash = undefined
      const historyId = 91525
      const path = '/some/path/here.jpg'

      await this.TpdsUpdateSender.promises.addFile({
        projectId,
        historyId,
        fileId,
        hash,
        path,
        projectName,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'pipeStreamFrom',
            job: {
              method: 'post',
              streamOrigin: `${filestoreUrl}/project/${projectId}/file/${fileId}?from=tpdsAddFile`,
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {},
          },
        }
      )
    })

    it('queues a post the file with user and file id and hash', async function () {
      const fileId = '4545345'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const historyId = 91525
      const path = '/some/path/here.jpg'

      await this.TpdsUpdateSender.promises.addFile({
        projectId,
        historyId,
        fileId,
        hash,
        path,
        projectName,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'pipeStreamFrom',
            job: {
              method: 'post',
              streamOrigin: `${projectHistoryUrl}/project/${historyId}/blob/${hash}`,
              streamFallback: `${filestoreUrl}/project/${projectId}/file/${fileId}?from=tpdsAddFile`,
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: readOnlyRef,
            job: {},
          },
        }
      )
    })

    it('post doc with stream origin of docstore', async function () {
      const docId = '4545345'
      const path = '/some/path/here.tex'
      const lines = ['line1', 'line2', 'line3']

      await this.TpdsUpdateSender.promises.addDoc({
        projectId,
        docId,
        path,
        docLines: lines,
        projectName,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: userId,
            method: 'pipeStreamFrom',
            job: {
              method: 'post',
              uri: `${thirdPartyDataStoreApiUrl}/user/${userId}/entity/${encodeURIComponent(
                projectName
              )}${encodeURIComponent(path)}`,
              streamOrigin: `${this.docstoreUrl}/project/${projectId}/doc/${docId}/raw`,
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

    it('deleting entity', async function () {
      const path = '/path/here/t.tex'
      const subtreeEntityIds = ['id1', 'id2']

      await this.TpdsUpdateSender.promises.deleteEntity({
        projectId,
        path,
        projectName,
        subtreeEntityIds,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

    it('moving entity', async function () {
      const startPath = 'staring/here/file.tex'
      const endPath = 'ending/here/file.tex'

      await this.TpdsUpdateSender.promises.moveEntity({
        projectId,
        startPath,
        endPath,
        projectName,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

    it('should be able to rename a project using the move entity func', async function () {
      const oldProjectName = '/oldProjectName/'
      const newProjectName = '/newProjectName/'

      await this.TpdsUpdateSender.promises.moveEntity({
        projectId,
        projectName: oldProjectName,
        newProjectName,
      })

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
        {
          json: {
            group: collaberatorRef,
            job: {
              headers: {},
            },
          },
        }
      )

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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

    it('pollDropboxForUser', async function () {
      await this.TpdsUpdateSender.promises.pollDropboxForUser(userId)

      expect(this.FetchUtils.fetchNothing).to.have.been.calledWithMatch(
        this.enqueueUrl,
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
    beforeEach(function () {
      this.UserGetter.promises.getUsers
        .withArgs({
          _id: {
            $in: this.memberIds,
          },
          'dropbox.access_token.uid': { $ne: null },
        })
        .resolves([])
    })

    it('does not make request to tpds', async function () {
      const fileId = '4545345'
      const hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const historyId = 91525
      const path = '/some/path/here.jpg'

      await this.TpdsUpdateSender.promises.addFile({
        projectId,
        historyId,
        hash,
        fileId,
        path,
        projectName,
      })
      this.FetchUtils.fetchNothing.should.not.have.been.called
    })
  })
})
