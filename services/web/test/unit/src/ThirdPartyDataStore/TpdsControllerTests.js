const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsController.js'

describe('TpdsController', function () {
  beforeEach(function () {
    this.metadata = {
      entityId: ObjectId(),
      folderId: ObjectId(),
      entityType: 'doc',
      rev: 2,
    }
    this.TpdsUpdateHandler = {
      promises: {
        newUpdate: sinon.stub().resolves(this.metadata),
        deleteUpdate: sinon.stub().resolves(),
      },
    }
    this.UpdateMerger = {
      promises: {
        mergeUpdate: sinon.stub().resolves(this.file),
        deleteUpdate: sinon.stub().resolves(),
      },
    }
    this.NotificationsBuilder = {
      tpdsFileLimit: sinon.stub().returns({ create: sinon.stub() }),
    }
    this.SessionManager = {
      getLoggedInUserId: sinon.stub().returns('user-id'),
    }
    this.TpdsQueueManager = {
      promises: {
        getQueues: sinon.stub().resolves('queues'),
      },
    }

    this.TpdsController = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './TpdsUpdateHandler': this.TpdsUpdateHandler,
        './UpdateMerger': this.UpdateMerger,
        '../Notifications/NotificationsBuilder': this.NotificationsBuilder,
        '../Authentication/SessionManager': this.SessionManager,
        './TpdsQueueManager': this.TpdsQueueManager,
      },
    })

    this.user_id = 'dsad29jlkjas'
  })

  describe('getting an update', function () {
    beforeEach(function () {
      this.projectName = 'projectName'
      this.path = '/here.txt'
      this.req = {
        params: { 0: `${this.projectName}${this.path}`, user_id: this.user_id },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox'),
        },
      }
    })

    it('should process the update with the update receiver', function (done) {
      const res = {
        json: payload => {
          expect(payload).to.deep.equal({
            status: 'applied',
            entityId: this.metadata.entityId.toString(),
            folderId: this.metadata.folderId.toString(),
            entityType: this.metadata.entityType,
            rev: this.metadata.rev.toString(),
          })
          this.TpdsUpdateHandler.promises.newUpdate
            .calledWith(
              this.user_id,
              this.projectName,
              this.path,
              this.req,
              this.source
            )
            .should.equal(true)
          done()
        },
      }
      this.TpdsController.mergeUpdate(this.req, res)
    })

    it('should indicate in the response when the update was rejected', function (done) {
      this.TpdsUpdateHandler.promises.newUpdate.resolves(null)
      const res = {
        json: payload => {
          expect(payload).to.deep.equal({ status: 'rejected' })
          done()
        },
      }
      this.TpdsController.mergeUpdate(this.req, res)
    })

    it('should return a 500 error when the update receiver fails', function (done) {
      this.TpdsUpdateHandler.promises.newUpdate.rejects(new Error())
      const res = {
        json: sinon.stub(),
      }
      this.TpdsController.mergeUpdate(this.req, res, err => {
        expect(err).to.exist
        expect(res.json).not.to.have.been.called
        done()
      })
    })

    it('should return a 400 error when the project is too big', function (done) {
      this.TpdsUpdateHandler.promises.newUpdate.rejects({
        message: 'project_has_too_many_files',
      })
      const res = {
        sendStatus: status => {
          expect(status).to.equal(400)
          this.NotificationsBuilder.tpdsFileLimit.should.have.been.calledWith(
            this.user_id
          )
          done()
        },
      }
      this.TpdsController.mergeUpdate(this.req, res)
    })

    it('should return a 429 error when the update receiver fails due to too many requests error', function (done) {
      this.TpdsUpdateHandler.promises.newUpdate.rejects(
        new Errors.TooManyRequestsError('project on cooldown')
      )
      const res = {
        sendStatus: status => {
          expect(status).to.equal(429)
          done()
        },
      }
      this.TpdsController.mergeUpdate(this.req, res)
    })
  })

  describe('getting a delete update', function () {
    it('should process the delete with the update receiver', function (done) {
      const path = '/projectName/here.txt'
      const req = {
        params: { 0: path, user_id: this.user_id },
        session: {
          destroy() {},
        },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox'),
        },
      }
      const res = {
        sendStatus: () => {
          this.TpdsUpdateHandler.promises.deleteUpdate
            .calledWith(this.user_id, 'projectName', '/here.txt', this.source)
            .should.equal(true)
          done()
        },
      }
      this.TpdsController.deleteUpdate(req, res)
    })
  })

  describe('parseParams', function () {
    it('should take the project name off the start and replace with slash', function () {
      const path = 'noSlashHere'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.userId.should.equal(this.user_id)
      result.filePath.should.equal('/')
      result.projectName.should.equal(path)
    })

    it('should take the project name off the start and it with no slashes in', function () {
      const path = '/project/file.tex'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.userId.should.equal(this.user_id)
      result.filePath.should.equal('/file.tex')
      result.projectName.should.equal('project')
    })

    it('should take the project name of and return a slash for the file path', function () {
      const path = '/project_name'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.projectName.should.equal('project_name')
      result.filePath.should.equal('/')
    })
  })

  describe('updateProjectContents', function () {
    beforeEach(function (done) {
      this.req = {
        params: {
          0: (this.path = 'chapters/main.tex'),
          project_id: (this.project_id = 'project-id-123'),
        },
        session: {
          destroy: sinon.stub(),
        },
        headers: {
          'x-sl-update-source': (this.source = 'github'),
        },
      }
      this.res = {
        sendStatus: sinon.stub().callsFake(() => {
          done()
        }),
      }

      this.TpdsController.updateProjectContents(this.req, this.res, this.next)
    })

    it('should merge the update', function () {
      this.UpdateMerger.promises.mergeUpdate
        .calledWith(
          null,
          this.project_id,
          `/${this.path}`,
          this.req,
          this.source
        )
        .should.equal(true)
    })

    it('should return a success', function () {
      this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('deleteProjectContents', function () {
    beforeEach(function (done) {
      this.req = {
        params: {
          0: (this.path = 'chapters/main.tex'),
          project_id: (this.project_id = 'project-id-123'),
        },
        session: {
          destroy: sinon.stub(),
        },
        headers: {
          'x-sl-update-source': (this.source = 'github'),
        },
      }
      this.res = {
        sendStatus: sinon.stub().callsFake(() => {
          done()
        }),
      }

      this.TpdsController.deleteProjectContents(this.req, this.res, this.next)
    })

    it('should delete the file', function () {
      this.UpdateMerger.promises.deleteUpdate
        .calledWith(null, this.project_id, `/${this.path}`, this.source)
        .should.equal(true)
    })

    it('should return a success', function () {
      this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('getQueues', function () {
    beforeEach(function () {
      this.req = {}
      this.res = { json: sinon.stub() }
      this.next = sinon.stub()
    })

    describe('success', function () {
      beforeEach(function (done) {
        this.res.json.callsFake(() => {
          done()
        })
        this.TpdsController.getQueues(this.req, this.res, this.next)
      })

      it('should use userId from session', function () {
        this.SessionManager.getLoggedInUserId.should.have.been.calledOnce
        this.TpdsQueueManager.promises.getQueues.should.have.been.calledWith(
          'user-id'
        )
      })

      it('should call json with response', function () {
        this.res.json.should.have.been.calledWith('queues')
        this.next.should.not.have.been.called
      })
    })

    describe('error', function () {
      beforeEach(function (done) {
        this.err = new Error()
        this.TpdsQueueManager.promises.getQueues = sinon
          .stub()
          .rejects(this.err)
        this.next.callsFake(() => {
          done()
        })
        this.TpdsController.getQueues(this.req, this.res, this.next)
      })

      it('should call next with error', function () {
        this.res.json.should.not.have.been.called
        this.next.should.have.been.calledWith(this.err)
      })
    })
  })
})
