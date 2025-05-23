const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const {
  cleanupTestDatabase,
  db,
  waitForDb,
} = require('../../../../app/src/infrastructure/mongodb')

const MODULE_PATH = '../../../../app/src/Features/History/HistoryManager'

const GLOBAL_BLOBS = {
  e69de29bb2d1d6434b8b29ae775ad8c2e48c5391:
    'e6/9d/e29bb2d1d6434b8b29ae775ad8c2e48c5391',
  '02426c2b3a484003ca42ed52b374b7907b757d12':
    '02/42/6c2b3a484003ca42ed52b374b7907b757d12',
}

describe('HistoryManager', function () {
  before(async function () {
    await waitForDb()
  })
  before(cleanupTestDatabase)
  before(async function () {
    await db.projectHistoryGlobalBlobs.insertMany(
      Object.keys(GLOBAL_BLOBS).map(sha => ({
        _id: sha,
        byteLength: 0,
        stringLength: 0,
      }))
    )
  })

  beforeEach(function () {
    this.user_id = 'user-id-123'
    this.historyId = new ObjectId().toString()
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
    }
    this.FetchUtils = {
      fetchJson: sinon.stub(),
      fetchNothing: sinon.stub().resolves(),
    }
    this.projectHistoryUrl = 'http://project_history.example.com'
    this.v1HistoryUrl = 'http://v1_history.example.com'
    this.v1HistoryUser = 'system'
    this.v1HistoryPassword = 'verysecret'
    this.settings = {
      apis: {
        project_history: {
          url: this.projectHistoryUrl,
        },
        v1_history: {
          url: this.v1HistoryUrl,
          user: this.v1HistoryUser,
          pass: this.v1HistoryPassword,
          buckets: {
            globalBlobs: 'globalBlobs',
            projectBlobs: 'projectBlobs',
          },
        },
      },
    }

    this.UserGetter = {
      promises: {
        getUsersByV1Ids: sinon.stub(),
        getUsers: sinon.stub(),
      },
    }

    this.project = {
      overleaf: {
        history: {
          id: this.historyId,
        },
      },
    }

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }

    this.HistoryBackupDeletionHandler = {
      deleteProject: sinon.stub().resolves(),
    }

    this.HistoryManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '../../infrastructure/mongodb': { ObjectId, db, waitForDb },
        '@overleaf/fetch-utils': this.FetchUtils,
        '@overleaf/settings': this.settings,
        '../User/UserGetter': this.UserGetter,
        '../Project/ProjectGetter': this.ProjectGetter,
        './HistoryBackupDeletionHandler': this.HistoryBackupDeletionHandler,
      },
    })
  })

  describe('getBlobLocation', function () {
    beforeEach(async function () {
      await this.HistoryManager.loadGlobalBlobsPromise
    })
    it('should return a global blob location', function () {
      for (const [sha, key] of Object.entries(GLOBAL_BLOBS)) {
        expect(this.HistoryManager.getBlobLocation('42', sha)).to.deep.equal({
          bucket: this.settings.apis.v1_history.buckets.globalBlobs,
          key,
        })
      }
    })
    it('should return a project blob location', function () {
      const sha = '6ddfa0578a67fe5ad6623a8665ec9aafce1eb5ca'
      const key = '240/000/000/6d/dfa0578a67fe5ad6623a8665ec9aafce1eb5ca'
      expect(this.HistoryManager.getBlobLocation('42', sha)).to.deep.equal({
        bucket: this.settings.apis.v1_history.buckets.projectBlobs,
        key,
      })
    })
  })

  describe('initializeProject', function () {
    beforeEach(function () {
      this.settings.apis.project_history.initializeHistoryForNewProjects = true
    })

    describe('project history returns a successful response', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchJson.resolves({ project: { id: this.historyId } })
        this.result = await this.HistoryManager.promises.initializeProject(
          this.historyId
        )
      })

      it('should call the project history api', function () {
        this.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          `${this.settings.apis.project_history.url}/project`,
          { method: 'POST' }
        )
      })

      it('should return the overleaf id', function () {
        expect(this.result).to.equal(this.historyId)
      })
    })

    describe('project history returns a response without the project id', function () {
      it('should throw an error', async function () {
        this.FetchUtils.fetchJson.resolves({ project: {} })
        await expect(
          this.HistoryManager.promises.initializeProject(this.historyId)
        ).to.be.rejected
      })
    })

    describe('project history errors', function () {
      it('should propagate the error', async function () {
        this.FetchUtils.fetchJson.rejects(new Error('problem connecting'))
        await expect(
          this.HistoryManager.promises.initializeProject(this.historyId)
        ).to.be.rejected
      })
    })
  })

  describe('injectUserDetails', function () {
    beforeEach(function () {
      this.user1 = {
        _id: (this.user_id1 = '123456'),
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        overleaf: { id: 5011 },
      }
      this.user1_view = {
        id: this.user_id1,
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
      }
      this.user2 = {
        _id: (this.user_id2 = 'abcdef'),
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }
      this.user2_view = {
        id: this.user_id2,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
      }
      this.UserGetter.promises.getUsersByV1Ids.resolves([this.user1])
      this.UserGetter.promises.getUsers.resolves([this.user1, this.user2])
    })

    describe('with a diff', function () {
      it('should turn user_ids into user objects', async function () {
        const diff = await this.HistoryManager.promises.injectUserDetails({
          diff: [
            {
              i: 'foo',
              meta: {
                users: [this.user_id1],
              },
            },
            {
              i: 'bar',
              meta: {
                users: [this.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
      })

      it('should handle v1 user ids', async function () {
        const diff = await this.HistoryManager.promises.injectUserDetails({
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
                users: [this.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
      })

      it('should leave user objects', async function () {
        const diff = await this.HistoryManager.promises.injectUserDetails({
          diff: [
            {
              i: 'foo',
              meta: {
                users: [this.user1_view],
              },
            },
            {
              i: 'bar',
              meta: {
                users: [this.user_id2],
              },
            },
          ],
        })
        expect(diff.diff[0].meta.users).to.deep.equal([this.user1_view])
        expect(diff.diff[1].meta.users).to.deep.equal([this.user2_view])
      })

      it('should handle a binary diff marker', async function () {
        const diff = await this.HistoryManager.promises.injectUserDetails({
          diff: { binary: true },
        })
        expect(diff.diff.binary).to.be.true
      })
    })

    describe('with a list of updates', function () {
      it('should turn user_ids into user objects', async function () {
        const updates = await this.HistoryManager.promises.injectUserDetails({
          updates: [
            {
              fromV: 5,
              toV: 8,
              meta: {
                users: [this.user_id1],
              },
            },
            {
              fromV: 4,
              toV: 5,
              meta: {
                users: [this.user_id2],
              },
            },
          ],
        })
        expect(updates.updates[0].meta.users).to.deep.equal([this.user1_view])
        expect(updates.updates[1].meta.users).to.deep.equal([this.user2_view])
      })

      it('should leave user objects', async function () {
        const updates = await this.HistoryManager.promises.injectUserDetails({
          updates: [
            {
              fromV: 5,
              toV: 8,
              meta: {
                users: [this.user1_view],
              },
            },
            {
              fromV: 4,
              toV: 5,
              meta: {
                users: [this.user_id2],
              },
            },
          ],
        })
        expect(updates.updates[0].meta.users).to.deep.equal([this.user1_view])
        expect(updates.updates[1].meta.users).to.deep.equal([this.user2_view])
      })
    })
  })

  describe('deleteProject', function () {
    const projectId = new ObjectId()
    const historyId = new ObjectId()

    beforeEach(async function () {
      await this.HistoryManager.promises.deleteProject(projectId, historyId)
    })

    it('should call the project-history service', async function () {
      expect(this.FetchUtils.fetchNothing).to.have.been.calledWith(
        `${this.projectHistoryUrl}/project/${projectId}`,
        { method: 'DELETE' }
      )
    })

    it('should call the v1-history service', async function () {
      expect(this.FetchUtils.fetchNothing).to.have.been.calledWith(
        `${this.v1HistoryUrl}/projects/${historyId}`,
        {
          method: 'DELETE',
          basicAuth: {
            user: this.v1HistoryUser,
            password: this.v1HistoryPassword,
          },
        }
      )
    })

    it('should call the history-backup-deletion service', async function () {
      expect(
        this.HistoryBackupDeletionHandler.deleteProject
      ).to.have.been.calledWith(projectId)
    })
  })
})
