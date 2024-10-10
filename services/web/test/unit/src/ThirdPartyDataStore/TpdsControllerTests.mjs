import mongodb from 'mongodb-legacy'
import { expect } from 'chai'
import esmock from 'esmock'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import MockResponse from '../helpers/MockResponse.js'
import MockRequest from '../helpers/MockRequest.js'

const ObjectId = mongodb.ObjectId

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsController.mjs'

describe('TpdsController', function () {
  beforeEach(async function () {
    this.metadata = {
      projectId: new ObjectId(),
      entityId: new ObjectId(),
      folderId: new ObjectId(),
      entityType: 'doc',
      rev: 2,
    }
    this.TpdsUpdateHandler = {
      promises: {
        newUpdate: sinon.stub().resolves(this.metadata),
        deleteUpdate: sinon.stub().resolves(),
        createFolder: sinon.stub().resolves(),
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
    this.HttpErrorHandler = {
      conflict: sinon.stub(),
    }

    this.newProject = { _id: new ObjectId() }
    this.ProjectCreationHandler = {
      promises: { createBlankProject: sinon.stub().resolves(this.newProject) },
    }
    this.ProjectDetailsHandler = {
      promises: {
        generateUniqueName: sinon.stub().resolves('unique'),
      },
    }
    this.TpdsController = await esmock.strict(MODULE_PATH, {
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateHandler':
        this.TpdsUpdateHandler,
      '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger':
        this.UpdateMerger,
      '../../../../app/src/Features/Notifications/NotificationsBuilder':
        this.NotificationsBuilder,
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/Errors/HttpErrorHandler':
        this.HttpErrorHandler,
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsQueueManager':
        this.TpdsQueueManager,
      '../../../../app/src/Features/Project/ProjectCreationHandler':
        this.ProjectCreationHandler,
      '../../../../app/src/Features/Project/ProjectDetailsHandler':
        this.ProjectDetailsHandler,
    })

    this.user_id = 'dsad29jlkjas'
  })

  describe('creating a project', function () {
    it('should yield the new projects id', function (done) {
      const res = new MockResponse()
      const req = new MockRequest()
      req.params.user_id = this.user_id
      req.body = { projectName: 'foo' }
      res.callback = err => {
        if (err) done(err)
        expect(res.body).to.equal(
          JSON.stringify({ projectId: this.newProject._id.toString() })
        )
        expect(
          this.ProjectDetailsHandler.promises.generateUniqueName
        ).to.have.been.calledWith(this.user_id, 'foo')
        expect(
          this.ProjectCreationHandler.promises.createBlankProject
        ).to.have.been.calledWith(
          this.user_id,
          'unique',
          {},
          { skipCreatingInTPDS: true }
        )
        done()
      }
      this.TpdsController.createProject(req, res)
    })
  })

  describe('getting an update', function () {
    beforeEach(function () {
      this.projectName = 'projectName'
      this.path = '/here.txt'
      this.req = {
        params: {
          0: `${this.projectName}${this.path}`,
          user_id: this.user_id,
          project_id: '',
        },
        headers: {
          'x-update-source': (this.source = 'dropbox'),
        },
      }
    })

    it('should process the update with the update receiver by name', function (done) {
      const res = {
        json: payload => {
          expect(payload).to.deep.equal({
            status: 'applied',
            projectId: this.metadata.projectId.toString(),
            entityId: this.metadata.entityId.toString(),
            folderId: this.metadata.folderId.toString(),
            entityType: this.metadata.entityType,
            rev: this.metadata.rev.toString(),
          })
          this.TpdsUpdateHandler.promises.newUpdate
            .calledWith(
              this.user_id,
              '', // projectId
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

    it('should process the update with the update receiver by id', function (done) {
      const path = '/here.txt'
      const req = {
        pause() {},
        params: { 0: path, user_id: this.user_id, project_id: '123' },
        session: {
          destroy() {},
        },
        headers: {
          'x-update-source': (this.source = 'dropbox'),
        },
      }
      const res = {
        json: () => {
          this.TpdsUpdateHandler.promises.newUpdate.should.have.been.calledWith(
            this.user_id,
            '123',
            '', // projectName
            '/here.txt',
            req,
            this.source
          )
          done()
        },
      }
      this.TpdsController.mergeUpdate(req, res)
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
    it('should process the delete with the update receiver by name', function (done) {
      const path = '/projectName/here.txt'
      const req = {
        params: { 0: path, user_id: this.user_id, project_id: '' },
        session: {
          destroy() {},
        },
        headers: {
          'x-update-source': (this.source = 'dropbox'),
        },
      }
      const res = {
        sendStatus: () => {
          this.TpdsUpdateHandler.promises.deleteUpdate
            .calledWith(
              this.user_id,
              '',
              'projectName',
              '/here.txt',
              this.source
            )
            .should.equal(true)
          done()
        },
      }
      this.TpdsController.deleteUpdate(req, res)
    })

    it('should process the delete with the update receiver by id', function (done) {
      const path = '/here.txt'
      const req = {
        params: { 0: path, user_id: this.user_id, project_id: '123' },
        session: {
          destroy() {},
        },
        headers: {
          'x-update-source': (this.source = 'dropbox'),
        },
      }
      const res = {
        sendStatus: () => {
          this.TpdsUpdateHandler.promises.deleteUpdate.should.have.been.calledWith(
            this.user_id,
            '123',
            '', // projectName
            '/here.txt',
            this.source
          )
          done()
        },
      }
      this.TpdsController.deleteUpdate(req, res)
    })
  })

  describe('updateFolder', function () {
    beforeEach(function () {
      this.req = {
        body: { userId: this.user_id, path: '/abc/def/ghi.txt' },
      }
      this.res = {
        json: sinon.stub(),
      }
    })

    it("creates a folder if it doesn't exist", function (done) {
      const metadata = {
        folderId: new ObjectId(),
        projectId: new ObjectId(),
        path: '/def/ghi.txt',
        parentFolderId: new ObjectId(),
      }
      this.TpdsUpdateHandler.promises.createFolder.resolves(metadata)
      this.res.json.callsFake(body => {
        expect(body).to.deep.equal({
          entityId: metadata.folderId.toString(),
          projectId: metadata.projectId.toString(),
          path: metadata.path,
          folderId: metadata.parentFolderId.toString(),
        })
        done()
      })
      this.TpdsController.updateFolder(this.req, this.res)
    })

    it('supports top level folders', function (done) {
      const metadata = {
        folderId: new ObjectId(),
        projectId: new ObjectId(),
        path: '/',
        parentFolderId: null,
      }
      this.TpdsUpdateHandler.promises.createFolder.resolves(metadata)
      this.res.json.callsFake(body => {
        expect(body).to.deep.equal({
          entityId: metadata.folderId.toString(),
          projectId: metadata.projectId.toString(),
          path: metadata.path,
          folderId: null,
        })
        done()
      })
      this.TpdsController.updateFolder(this.req, this.res)
    })

    it("returns a 409 if the folder couldn't be created", function (done) {
      this.TpdsUpdateHandler.promises.createFolder.resolves(null)
      this.HttpErrorHandler.conflict.callsFake((req, res) => {
        expect(req).to.equal(this.req)
        expect(res).to.equal(this.res)
        done()
      })
      this.TpdsController.updateFolder(this.req, this.res)
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
          'x-update-source': (this.source = 'github'),
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
          'x-update-source': (this.source = 'github'),
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
