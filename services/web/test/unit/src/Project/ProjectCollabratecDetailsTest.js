const { ObjectId } = require('mongodb-legacy')
const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const sinon = require('sinon')

const modulePath = Path.join(
  __dirname,
  '../../../../app/src/Features/Project/ProjectCollabratecDetailsHandler'
)

describe('ProjectCollabratecDetailsHandler', function () {
  beforeEach(function () {
    this.projectId = new ObjectId('5bea8747c7bba6012fcaceb3')
    this.userId = new ObjectId('5be316a9c7f6aa03802ea8fb')
    this.userId2 = new ObjectId('5c1794b3f0e89b1d1c577eca')
    this.ProjectModel = {}
    this.ProjectCollabratecDetailsHandler = SandboxedModule.require(
      modulePath,
      {
        requires: {
          'mongodb-legacy': { ObjectId },
          '../../models/Project': { Project: this.ProjectModel },
        },
      }
    )
  })

  describe('initializeCollabratecProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await this.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
          this.projectId,
          this.userId,
          'collabratec-document-id',
          'collabratec-private-group-id'
        )
      })

      it('should update project model', function () {
        const update = {
          $set: {
            collabratecUsers: [
              {
                user_id: this.userId,
                collabratec_document_id: 'collabratec-document-id',
                collabratec_privategroup_id: 'collabratec-private-group-id',
              },
            ],
          },
        }
        expect(this.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: this.projectId },
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function () {
        await expect(
          this.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
            this.projectId,
            this.userId,
            'collabratec-document-id',
            'collabratec-private-group-id'
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.initializeCollabratecProject(
            'bad-project-id',
            'bad-user-id',
            'collabratec-document-id',
            'collabratec-private-group-id'
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('isLinkedCollabratecUserProject', function () {
    beforeEach(function () {
      this.ProjectModel.findOne = sinon.stub().resolves()
    })

    describe('when find succeeds', function () {
      describe('when user project found', function () {
        beforeEach(async function () {
          this.ProjectModel.findOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves('project') })
          this.result =
            await this.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
              this.projectId,
              this.userId
            )
        })

        it('should call find with project and user id', function () {
          expect(this.ProjectModel.findOne).to.have.been.calledWithMatch({
            _id: new ObjectId(this.projectId),
            collabratecUsers: {
              $elemMatch: {
                user_id: new ObjectId(this.userId),
              },
            },
          })
        })

        it('should return true', function () {
          expect(this.result).to.equal(true)
        })
      })

      describe('when user project is not found', function () {
        beforeEach(async function () {
          this.ProjectModel.findOne = sinon
            .stub()
            .returns({ exec: sinon.stub().resolves(null) })
          this.result =
            await this.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
              this.projectId,
              this.userId
            )
        })

        it('should return false', function () {
          expect(this.result).to.equal(false)
        })
      })
    })

    describe('when find has error', function () {
      beforeEach(function () {
        this.ProjectModel.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function () {
        await expect(
          this.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
            this.projectId,
            this.userId
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function () {
        this.ProjectModel.findOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.isLinkedCollabratecUserProject(
            'bad-project-id',
            'bad-user-id'
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.findOne).not.to.have.been.called
      })
    })
  })

  describe('linkCollabratecUserProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await this.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
          this.projectId,
          this.userId,
          'collabratec-document-id'
        )
      })

      it('should update project model', function () {
        const query = {
          _id: this.projectId,
          collabratecUsers: {
            $not: {
              $elemMatch: {
                collabratec_document_id: 'collabratec-document-id',
                user_id: this.userId,
              },
            },
          },
        }
        const update = {
          $push: {
            collabratecUsers: {
              collabratec_document_id: 'collabratec-document-id',
              user_id: this.userId,
            },
          },
        }
        expect(this.ProjectModel.updateOne).to.have.been.calledWith(
          query,
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function () {
        await expect(
          this.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
            this.projectId,
            this.userId,
            'collabratec-document-id'
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.linkCollabratecUserProject(
            'bad-project-id',
            'bad-user-id',
            'collabratec-document-id'
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('setCollabratecUsers', function () {
    beforeEach(function () {
      this.collabratecUsers = [
        {
          user_id: this.userId,
          collabratec_document_id: 'collabratec-document-id-1',
          collabratec_privategroup_id: 'collabratec-private-group-id-1',
        },
        {
          user_id: this.userId2,
          collabratec_document_id: 'collabratec-document-id-2',
          collabratec_privategroup_id: 'collabratec-private-group-id-2',
        },
      ]
    })

    describe('when update succeeds', function () {
      beforeEach(async function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await this.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
          this.projectId,
          this.collabratecUsers
        )
      })

      it('should update project model', function () {
        const update = {
          $set: {
            collabratecUsers: this.collabratecUsers,
          },
        }
        expect(this.ProjectModel.updateOne).to.have.been.calledWith(
          { _id: this.projectId },
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function () {
        await expect(
          this.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            this.projectId,
            this.collabratecUsers
          )
        ).to.be.rejected
      })
    })

    describe('with invalid project_id', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            'bad-project-id',
            this.collabratecUsers
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.updateOne).not.to.have.been.called
      })
    })

    describe('with invalid user_id', function () {
      beforeEach(function () {
        this.collabratecUsers[1].user_id = 'bad-user-id'
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.setCollabratecUsers(
            this.projectId,
            this.collabratecUsers
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })

  describe('unlinkCollabratecUserProject', function () {
    describe('when update succeeds', function () {
      beforeEach(async function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        await this.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
          this.projectId,
          this.userId
        )
      })

      it('should update project model', function () {
        const query = { _id: this.projectId }
        const update = {
          $pull: {
            collabratecUsers: {
              user_id: this.userId,
            },
          },
        }
        expect(this.ProjectModel.updateOne).to.have.been.calledWith(
          query,
          update
        )
      })
    })

    describe('when update has error', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().rejects() })
      })

      it('should be rejected', async function () {
        await expect(
          this.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
            this.projectId,
            this.userId
          )
        ).to.be.rejected
      })
    })

    describe('with invalid args', function () {
      beforeEach(function () {
        this.ProjectModel.updateOne = sinon
          .stub()
          .returns({ exec: sinon.stub().resolves() })
        this.resultPromise =
          this.ProjectCollabratecDetailsHandler.promises.unlinkCollabratecUserProject(
            'bad-project-id',
            'bad-user-id'
          )
      })

      it('should be rejected without updating', async function () {
        await expect(this.resultPromise).to.be.rejected
        expect(this.ProjectModel.updateOne).not.to.have.been.called
      })
    })
  })
})
