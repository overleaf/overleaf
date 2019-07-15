/* eslint-disable
    max-len,
    mocha/no-identical-title,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('mongojs')
const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const chai = require('chai')
const sinon = require('sinon')

const { expect } = chai

const modulePath = Path.join(
  __dirname,
  '../../../../app/src/Features/Project/ProjectCollabratecDetailsHandler'
)

describe('ProjectCollabratecDetailsHandler', function() {
  beforeEach(function() {
    this.projectId = ObjectId('5bea8747c7bba6012fcaceb3')
    this.userId = ObjectId('5be316a9c7f6aa03802ea8fb')
    this.userId2 = ObjectId('5c1794b3f0e89b1d1c577eca')
    this.ProjectModel = {}
    this.ProjectCollabratecDetailsHandler = SandboxedModule.require(
      modulePath,
      {
        globals: {
          console: console
        },
        requires: {
          '../../models/Project': { Project: this.ProjectModel }
        }
      }
    )
    return (this.callback = sinon.stub())
  })

  describe('initializeCollabratecProject', function() {
    describe('when update succeeds', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields()
        return this.ProjectCollabratecDetailsHandler.initializeCollabratecProject(
          this.projectId,
          this.userId,
          'collabratec-document-id',
          'collabratec-private-group-id',
          this.callback
        )
      })

      it('should update project model', function() {
        const update = {
          $set: {
            collabratecUsers: [
              {
                user_id: this.userId,
                collabratec_document_id: 'collabratec-document-id',
                collabratec_privategroup_id: 'collabratec-private-group-id'
              }
            ]
          }
        }
        return expect(this.ProjectModel.update).to.have.been.calledWith(
          { _id: this.projectId },
          update,
          this.callback
        )
      })
    })

    describe('when update has error', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.initializeCollabratecProject(
          this.projectId,
          this.userId,
          'collabratec-document-id',
          'collabratec-private-group-id',
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid args', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.initializeCollabratecProject(
          'bad-project-id',
          'bad-user-id',
          'collabratec-document-id',
          'collabratec-private-group-id',
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('isLinkedCollabratecUserProject', function() {
    beforeEach(function() {
      return (this.ProjectModel.findOne = sinon.stub().yields())
    })

    describe('when find succeeds', function() {
      describe('when user project found', function() {
        beforeEach(function() {
          this.ProjectModel.findOne = sinon.stub().yields(null, 'project')
          return this.ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject(
            this.projectId,
            this.userId,
            this.callback
          )
        })

        it('should call find with project and user id', function() {
          return expect(this.ProjectModel.findOne).to.have.been.calledWithMatch(
            {
              _id: ObjectId(this.projectId),
              collabratecUsers: {
                $elemMatch: {
                  user_id: ObjectId(this.userId)
                }
              }
            }
          )
        })

        it('should callback with true', function() {
          return expect(this.callback).to.have.been.calledWith(null, true)
        })
      })

      describe('when user project found', function() {
        beforeEach(function() {
          this.ProjectModel.findOne = sinon.stub().yields(null, null)
          return this.ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject(
            this.projectId,
            this.userId,
            this.callback
          )
        })

        it('should callback with false', function() {
          return expect(this.callback).to.have.been.calledWith(null, false)
        })
      })
    })

    describe('when find has error', function() {
      beforeEach(function() {
        this.ProjectModel.findOne = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject(
          this.projectId,
          this.userId,
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid args', function() {
      beforeEach(function() {
        this.ProjectModel.findOne = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject(
          'bad-project-id',
          'bad-user-id',
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.findOne).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('linkCollabratecUserProject', function() {
    describe('when update succeeds', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields()
        return this.ProjectCollabratecDetailsHandler.linkCollabratecUserProject(
          this.projectId,
          this.userId,
          'collabratec-document-id',
          this.callback
        )
      })

      it('should update project model', function() {
        const query = {
          _id: this.projectId,
          collabratecUsers: {
            $not: {
              $elemMatch: {
                collabratec_document_id: 'collabratec-document-id',
                user_id: this.userId
              }
            }
          }
        }
        const update = {
          $push: {
            collabratecUsers: {
              collabratec_document_id: 'collabratec-document-id',
              user_id: this.userId
            }
          }
        }
        return expect(this.ProjectModel.update).to.have.been.calledWith(
          query,
          update,
          this.callback
        )
      })
    })

    describe('when update has error', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.linkCollabratecUserProject(
          this.projectId,
          this.userId,
          'collabratec-document-id',
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid args', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.linkCollabratecUserProject(
          'bad-project-id',
          'bad-user-id',
          'collabratec-document-id',
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('setCollabratecUsers', function() {
    beforeEach(function() {
      return (this.collabratecUsers = [
        {
          user_id: this.userId,
          collabratec_document_id: 'collabratec-document-id-1',
          collabratec_privategroup_id: 'collabratec-private-group-id-1'
        },
        {
          user_id: this.userId2,
          collabratec_document_id: 'collabratec-document-id-2',
          collabratec_privategroup_id: 'collabratec-private-group-id-2'
        }
      ])
    })

    describe('when update succeeds', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields()
        return this.ProjectCollabratecDetailsHandler.setCollabratecUsers(
          this.projectId,
          this.collabratecUsers,
          this.callback
        )
      })

      it('should update project model', function() {
        const update = {
          $set: {
            collabratecUsers: this.collabratecUsers
          }
        }
        return expect(this.ProjectModel.update).to.have.been.calledWith(
          { _id: this.projectId },
          update,
          this.callback
        )
      })
    })

    describe('when update has error', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.setCollabratecUsers(
          this.projectId,
          this.collabratecUsers,
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid project_id', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.setCollabratecUsers(
          'bad-project-id',
          this.collabratecUsers,
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })

    describe('with invalid user_id', function() {
      beforeEach(function() {
        this.collabratecUsers[1].user_id = 'bad-user-id'
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.setCollabratecUsers(
          this.projectId,
          this.collabratecUsers,
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('unlinkCollabratecUserProject', function() {
    describe('when update succeeds', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields()
        return this.ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject(
          this.projectId,
          this.userId,
          this.callback
        )
      })

      it('should update project model', function() {
        const query = { _id: this.projectId }
        const update = {
          $pull: {
            collabratecUsers: {
              user_id: this.userId
            }
          }
        }
        return expect(this.ProjectModel.update).to.have.been.calledWith(
          query,
          update,
          this.callback
        )
      })
    })

    describe('when update has error', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject(
          this.projectId,
          this.userId,
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid args', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject(
          'bad-project-id',
          'bad-user-id',
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })

  describe('updateCollabratecUserIds', function() {
    describe('when update succeeds', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields()
        return this.ProjectCollabratecDetailsHandler.updateCollabratecUserIds(
          this.userId,
          this.userId2,
          this.callback
        )
      })

      it('should update project model', function() {
        return expect(this.ProjectModel.update).to.have.been.calledWith(
          { 'collabratecUsers.user_id': this.userId },
          { $set: { 'collabratecUsers.$.user_id': this.userId2 } },
          { multi: true },
          this.callback
        )
      })
    })

    describe('when update has error', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub().yields('error')
        return this.ProjectCollabratecDetailsHandler.updateCollabratecUserIds(
          this.userId,
          this.userId2,
          this.callback
        )
      })

      it('should callback with error', function() {
        return expect(this.callback).to.have.been.calledWith('error')
      })
    })

    describe('with invalid old_user_id', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.updateCollabratecUserIds(
          'bad-user-id',
          this.userId2,
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })

    describe('with invalid new_user_id', function() {
      beforeEach(function() {
        this.ProjectModel.update = sinon.stub()
        return this.ProjectCollabratecDetailsHandler.updateCollabratecUserIds(
          this.userId,
          'bad-user-id',
          this.callback
        )
      })

      it('should not update', function() {
        return expect(this.ProjectModel.update).not.to.have.beenCalled
      })

      it('should callback with error', function() {
        return expect(this.callback.firstCall.args[0]).to.be.instanceOf(Error)
      })
    })
  })
})
