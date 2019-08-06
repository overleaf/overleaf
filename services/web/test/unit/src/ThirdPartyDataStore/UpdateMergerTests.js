/* eslint-disable
    max-len,
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
const Stream = require('stream')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger.js'
)
const BufferedStream = require('bufferedstream')

describe('UpdateMerger :', function() {
  beforeEach(function() {
    this.updateMerger = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        fs: (this.fs = { unlink: sinon.stub().callsArgWith(1) }),
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        '../Editor/EditorController': (this.EditorController = {}),
        '../Uploads/FileTypeManager': (this.FileTypeManager = {}),
        '../../infrastructure/FileWriter': (this.FileWriter = {}),
        '../Project/ProjectEntityHandler': (this.ProjectEntityHandler = {}),
        'settings-sharelatex': { path: { dumpPath: 'dump_here' } }
      }
    })
    this.project_id = 'project_id_here'
    this.user_id = 'mock-user-id'

    this.docPath = this.newDocPath = '/folder/doc.tex'
    this.filePath = this.newFilePath = '/folder/file.png'

    this.existingDocPath = '/folder/other.tex'
    this.existingFilePath = '/folder/fig1.pdf'

    this.linkedFileData = { provider: 'url' }

    this.existingDocs = [{ path: '/main.tex' }, { path: '/folder/other.tex' }]
    this.existingFiles = [{ path: '/figure.pdf' }, { path: '/folder/fig1.pdf' }]
    this.ProjectEntityHandler.getAllEntities = sinon
      .stub()
      .callsArgWith(1, null, this.existingDocs, this.existingFiles)

    this.fsPath = '/tmp/file/path'
    this.source = 'dropbox'
    this.updateRequest = new BufferedStream()
    this.FileWriter.writeStreamToDisk = sinon.stub().yields(null, this.fsPath)
    return (this.callback = sinon.stub())
  })

  describe('mergeUpdate', function() {
    describe('doc updates for a new doc', function() {
      beforeEach(function() {
        this.FileTypeManager.getStrictType = sinon.stub().yields(null, false)
        this.updateMerger.p.processDoc = sinon.stub().yields()
        return this.updateMerger.mergeUpdate(
          this.user_id,
          this.project_id,
          this.docPath,
          this.updateRequest,
          this.source,
          this.callback
        )
      })

      it('should look at the file contents', function() {
        return this.FileTypeManager.getStrictType.called.should.equal(true)
      })

      it('should process update as doc', function() {
        return this.updateMerger.p.processDoc
          .calledWith(
            this.project_id,
            this.user_id,
            this.fsPath,
            this.docPath,
            this.source
          )
          .should.equal(true)
      })

      it('removes the temp file from disk', function() {
        return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
      })
    })

    describe('file updates for a new file ', function() {
      beforeEach(function() {
        this.FileTypeManager.getStrictType = sinon.stub().yields(null, true)
        this.updateMerger.p.processFile = sinon.stub().yields()
        return this.updateMerger.mergeUpdate(
          this.user_id,
          this.project_id,
          this.filePath,
          this.updateRequest,
          this.source,
          this.callback
        )
      })

      it('should look at the file contents', function() {
        return this.FileTypeManager.getStrictType.called.should.equal(true)
      })

      it('should process update as file', function() {
        return this.updateMerger.p.processFile
          .calledWith(
            this.project_id,
            this.fsPath,
            this.filePath,
            this.source,
            this.user_id
          )
          .should.equal(true)
      })

      it('removes the temp file from disk', function() {
        return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
      })
    })

    describe('doc updates for an existing doc', function() {
      beforeEach(function() {
        this.FileTypeManager.getStrictType = sinon.stub().yields(null, false)
        this.updateMerger.p.processDoc = sinon.stub().yields()
        return this.updateMerger.mergeUpdate(
          this.user_id,
          this.project_id,
          this.existingDocPath,
          this.updateRequest,
          this.source,
          this.callback
        )
      })

      it('should look at the file contents', function() {
        return this.FileTypeManager.getStrictType.called.should.equal(true)
      })

      it('should process update as doc', function() {
        return this.updateMerger.p.processDoc
          .calledWith(
            this.project_id,
            this.user_id,
            this.fsPath,
            this.existingDocPath,
            this.source
          )
          .should.equal(true)
      })

      it('removes the temp file from disk', function() {
        return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
      })
    })

    describe('file updates for an existing file', function() {
      beforeEach(function() {
        this.FileTypeManager.getStrictType = sinon.stub().yields(null, true)
        this.updateMerger.p.processFile = sinon.stub().yields()
        return this.updateMerger.mergeUpdate(
          this.user_id,
          this.project_id,
          this.existingFilePath,
          this.updateRequest,
          this.source,
          this.callback
        )
      })

      it('should look at the file contents', function() {
        return this.FileTypeManager.getStrictType.called.should.equal(true)
      })

      it('should process update as file', function() {
        return this.updateMerger.p.processFile
          .calledWith(
            this.project_id,
            this.fsPath,
            this.existingFilePath,
            this.source,
            this.user_id
          )
          .should.equal(true)
      })

      it('removes the temp file from disk', function() {
        return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
      })
    })
  })

  describe('file updates for an existing doc', function() {
    beforeEach(function() {
      this.FileTypeManager.getStrictType = sinon
        .stub()
        .yields(null, true, 'delete-existing-doc')
      this.updateMerger.deleteUpdate = sinon.stub().yields()
      this.updateMerger.p.processFile = sinon.stub().yields()
      return this.updateMerger.mergeUpdate(
        this.user_id,
        this.project_id,
        this.existingDocPath,
        this.updateRequest,
        this.source,
        this.callback
      )
    })

    it('should look at the file contents', function() {
      return this.FileTypeManager.getStrictType.called.should.equal(true)
    })

    it('should delete the existing doc', function() {
      this.updateMerger.deleteUpdate
        .calledWith(
          this.user_id,
          this.project_id,
          this.existingDocPath,
          this.source
        )
        .should.equal(true)
    })

    it('should process update as file', function() {
      return this.updateMerger.p.processFile
        .calledWith(
          this.project_id,
          this.fsPath,
          this.existingDocPath,
          this.source,
          this.user_id
        )
        .should.equal(true)
    })

    it('removes the temp file from disk', function() {
      return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
    })
  })

  describe('doc updates for an existing file', function() {
    beforeEach(function() {
      this.FileTypeManager.getStrictType = sinon.stub().yields(null, true)
      this.updateMerger.deleteUpdate = sinon.stub().yields()
      this.updateMerger.p.processFile = sinon.stub().yields()
      return this.updateMerger.mergeUpdate(
        this.user_id,
        this.project_id,
        this.existingFilePath,
        this.updateRequest,
        this.source,
        this.callback
      )
    })

    it('should look at the file contents', function() {
      return this.FileTypeManager.getStrictType.called.should.equal(true)
    })

    it('should not delete the existing file', function() {
      this.updateMerger.deleteUpdate.called.should.equal(false)
    })

    it('should process update as file', function() {
      return this.updateMerger.p.processFile
        .calledWith(
          this.project_id,
          this.fsPath,
          this.existingFilePath,
          this.source,
          this.user_id
        )
        .should.equal(true)
    })

    it('removes the temp file from disk', function() {
      return this.fs.unlink.calledWith(this.fsPath).should.equal(true)
    })
  })

  describe('deleteUpdate', function() {
    beforeEach(function() {
      this.EditorController.deleteEntityWithPath = sinon.stub().yields()
      return this.updateMerger.deleteUpdate(
        this.user_id,
        this.project_id,
        this.docPath,
        this.source,
        this.callback
      )
    })

    it('should delete the entity in the editor controller', function() {
      return this.EditorController.deleteEntityWithPath
        .calledWith(this.project_id, this.docPath, this.source, this.user_id)
        .should.equal(true)
    })
  })

  describe('private methods', function() {
    describe('processDoc', function() {
      beforeEach(function() {
        this.docLines =
          '\\documentclass{article}\n\\usepackage[utf8]{inputenc}\n\n\\title{42}\n\\author{Jane Doe}\n\\date{June 2011}'
        this.updateMerger.p.readFileIntoTextArray = sinon
          .stub()
          .yields(null, this.docLines)
        this.EditorController.upsertDocWithPath = sinon.stub().yields()

        return this.updateMerger.p.processDoc(
          this.project_id,
          this.user_id,
          this.fsPath,
          this.docPath,
          this.source,
          this.callback
        )
      })

      it('reads the temp file from disk', function() {
        return this.updateMerger.p.readFileIntoTextArray
          .calledWith(this.fsPath)
          .should.equal(true)
      })

      it('should upsert the doc in the editor controller', function() {
        return this.EditorController.upsertDocWithPath
          .calledWith(
            this.project_id,
            this.docPath,
            this.docLines,
            this.source,
            this.user_id
          )
          .should.equal(true)
      })
    })

    describe('processFile', function() {
      beforeEach(function() {
        this.EditorController.upsertFileWithPath = sinon.stub().yields()
        return this.updateMerger.p.processFile(
          this.project_id,
          this.fsPath,
          this.filePath,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should upsert the file in the editor controller', function() {
        return this.EditorController.upsertFileWithPath
          .calledWith(
            this.project_id,
            this.filePath,
            this.fsPath,
            null,
            this.source,
            this.user_id
          )
          .should.equal(true)
      })
    })
  })
})
