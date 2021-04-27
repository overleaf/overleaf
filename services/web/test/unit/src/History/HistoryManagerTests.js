const { expect } = require('chai')
const sinon = require('sinon')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')

const MODULE_PATH = '../../../../app/src/Features/History/HistoryManager'

describe('HistoryManager', function () {
  beforeEach(function () {
    this.user_id = 'user-id-123'
    this.AuthenticationController = {
      getLoggedInUserId: sinon.stub().returns(this.user_id),
    }
    this.request = {
      post: sinon.stub(),
      delete: sinon.stub().resolves(),
    }
    this.projectHistoryUrl = 'http://project_history.example.com'
    this.v1HistoryUrl = 'http://v1_history.example.com'
    this.v1HistoryUser = 'system'
    this.v1HistoryPassword = 'verysecret'
    this.settings = {
      apis: {
        trackchanges: {
          enabled: false,
          url: 'http://trackchanges.example.com',
        },
        project_history: {
          url: this.projectHistoryUrl,
        },
        v1_history: {
          url: this.v1HistoryUrl,
          user: this.v1HistoryUser,
          pass: this.v1HistoryPassword,
        },
      },
    }

    this.UserGetter = {
      promises: {
        getUsersByV1Ids: sinon.stub(),
        getUsers: sinon.stub(),
      },
    }

    this.HistoryManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'request-promise-native': this.request,
        'settings-sharelatex': this.settings,
        '../User/UserGetter': this.UserGetter,
      },
    })
  })

  describe('initializeProject', function () {
    describe('with project history enabled', function () {
      beforeEach(function () {
        this.settings.apis.project_history.initializeHistoryForNewProjects = true
      })

      describe('project history returns a successful response', function () {
        beforeEach(async function () {
          this.overleaf_id = 1234
          this.request.post.resolves(
            JSON.stringify({ project: { id: this.overleaf_id } })
          )
          this.result = await this.HistoryManager.promises.initializeProject()
        })

        it('should call the project history api', function () {
          this.request.post
            .calledWith({
              url: `${this.settings.apis.project_history.url}/project`,
            })
            .should.equal(true)
        })

        it('should return the overleaf id', function () {
          expect(this.result).to.deep.equal({ overleaf_id: this.overleaf_id })
        })
      })

      describe('project history returns a response without the project id', function () {
        it('should throw an error', async function () {
          this.request.post.resolves(JSON.stringify({ project: {} }))
          await expect(this.HistoryManager.promises.initializeProject()).to.be
            .rejected
        })
      })

      describe('project history errors', function () {
        it('should propagate the error', async function () {
          this.request.post.rejects(new Error('problem connecting'))
          await expect(this.HistoryManager.promises.initializeProject()).to.be
            .rejected
        })
      })
    })

    describe('with project history disabled', function () {
      it('should return without errors', async function () {
        this.settings.apis.project_history.initializeHistoryForNewProjects = false
        await expect(this.HistoryManager.promises.initializeProject()).to.be
          .fulfilled
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
      expect(this.request.delete).to.have.been.calledWith(
        `${this.projectHistoryUrl}/project/${projectId}`
      )
    })

    it('should call the v1-history service', async function () {
      expect(this.request.delete).to.have.been.calledWith({
        url: `${this.v1HistoryUrl}/projects/${historyId}`,
        auth: {
          user: this.v1HistoryUser,
          pass: this.v1HistoryPassword,
        },
      })
    })
  })
})
