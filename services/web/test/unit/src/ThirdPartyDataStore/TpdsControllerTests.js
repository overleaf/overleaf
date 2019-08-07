/* eslint-disable
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const Errors = require('../../../../app/src/Features/Errors/Errors')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/TpdsController.js'
)

describe('TpdsController', function() {
  beforeEach(function() {
    this.TpdsUpdateHandler = {}
    this.TpdsController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './TpdsUpdateHandler': this.TpdsUpdateHandler,
        './UpdateMerger': (this.UpdateMerger = {}),
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        'metrics-sharelatex': {
          inc() {}
        }
      }
    })

    this.user_id = 'dsad29jlkjas'
  })

  describe('getting an update', function() {
    it('should process the update with the update receiver', function(done) {
      const path = '/projectName/here.txt'
      const req = {
        pause() {},
        params: { 0: path, user_id: this.user_id },
        session: {
          destroy() {}
        },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox')
        }
      }
      this.TpdsUpdateHandler.newUpdate = sinon.stub().callsArg(5)
      const res = {
        sendStatus: () => {
          this.TpdsUpdateHandler.newUpdate
            .calledWith(
              this.user_id,
              'projectName',
              '/here.txt',
              req,
              this.source
            )
            .should.equal(true)
          done()
        }
      }
      this.TpdsController.mergeUpdate(req, res)
    })

    it('should return a 500 error when the update receiver fails', function() {
      const path = '/projectName/here.txt'
      const req = {
        pause() {},
        params: { 0: path, user_id: this.user_id },
        session: {
          destroy() {}
        },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox')
        }
      }
      this.TpdsUpdateHandler.newUpdate = sinon
        .stub()
        .callsArgWith(5, 'update-receiver-error')
      const res = {
        sendStatus: sinon.stub()
      }
      this.TpdsController.mergeUpdate(req, res)
      res.sendStatus.calledWith(500).should.equal(true)
    })

    it('should return a 429 error when the update receiver fails due to too many requests error', function() {
      const path = '/projectName/here.txt'
      const req = {
        pause() {},
        params: { 0: path, user_id: this.user_id },
        session: {
          destroy() {}
        },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox')
        }
      }
      this.TpdsUpdateHandler.newUpdate = sinon
        .stub()
        .callsArgWith(5, new Errors.TooManyRequestsError('project on cooldown'))
      const res = {
        sendStatus: sinon.stub()
      }
      this.TpdsController.mergeUpdate(req, res)
      res.sendStatus.calledWith(429).should.equal(true)
    })
  })

  describe('getting a delete update', function() {
    it('should process the delete with the update reciver', function(done) {
      const path = '/projectName/here.txt'
      const req = {
        params: { 0: path, user_id: this.user_id },
        session: {
          destroy() {}
        },
        headers: {
          'x-sl-update-source': (this.source = 'dropbox')
        }
      }
      this.TpdsUpdateHandler.deleteUpdate = sinon.stub().callsArg(4)
      const res = {
        sendStatus: () => {
          this.TpdsUpdateHandler.deleteUpdate
            .calledWith(this.user_id, 'projectName', '/here.txt', this.source)
            .should.equal(true)
          done()
        }
      }
      this.TpdsController.deleteUpdate(req, res)
    })
  })

  describe('parseParams', function() {
    it('should take the project name off the start and replace with slash', function() {
      const path = 'noSlashHere'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.user_id.should.equal(this.user_id)
      result.filePath.should.equal('/')
      result.projectName.should.equal(path)
    })

    it('should take the project name off the start and it with no slashes in', function() {
      const path = '/project/file.tex'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.user_id.should.equal(this.user_id)
      result.filePath.should.equal('/file.tex')
      result.projectName.should.equal('project')
    })

    it('should take the project name of and return a slash for the file path', function() {
      const path = '/project_name'
      const req = { params: { 0: path, user_id: this.user_id } }
      const result = this.TpdsController.parseParams(req)
      result.projectName.should.equal('project_name')
      result.filePath.should.equal('/')
    })
  })

  describe('updateProjectContents', function() {
    beforeEach(function() {
      this.UpdateMerger.mergeUpdate = sinon.stub().callsArg(5)
      this.req = {
        params: {
          0: (this.path = 'chapters/main.tex'),
          project_id: (this.project_id = 'project-id-123')
        },
        session: {
          destroy: sinon.stub()
        },
        headers: {
          'x-sl-update-source': (this.source = 'github')
        }
      }
      this.res = { sendStatus: sinon.stub() }

      this.TpdsController.updateProjectContents(this.req, this.res)
    })

    it('should merge the update', function() {
      this.UpdateMerger.mergeUpdate
        .calledWith(
          null,
          this.project_id,
          `/${this.path}`,
          this.req,
          this.source
        )
        .should.equal(true)
    })

    it('should return a success', function() {
      this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })

  describe('deleteProjectContents', function() {
    beforeEach(function() {
      this.UpdateMerger.deleteUpdate = sinon.stub().callsArg(4)
      this.req = {
        params: {
          0: (this.path = 'chapters/main.tex'),
          project_id: (this.project_id = 'project-id-123')
        },
        session: {
          destroy: sinon.stub()
        },
        headers: {
          'x-sl-update-source': (this.source = 'github')
        }
      }
      this.res = { sendStatus: sinon.stub() }

      this.TpdsController.deleteProjectContents(this.req, this.res)
    })

    it('should delete the file', function() {
      this.UpdateMerger.deleteUpdate
        .calledWith(null, this.project_id, `/${this.path}`, this.source)
        .should.equal(true)
    })

    it('should return a success', function() {
      this.res.sendStatus.calledWith(200).should.equal(true)
    })
  })
})
