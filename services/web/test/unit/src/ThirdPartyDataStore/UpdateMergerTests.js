const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { Writable } = require('stream')
const { ObjectId } = require('mongodb-legacy')

const MODULE_PATH =
  '../../../../app/src/Features/ThirdPartyDataStore/UpdateMerger.js'

describe('UpdateMerger :', function () {
  beforeEach(function () {
    this.projectId = 'project_id_here'
    this.userId = 'mock-user-id'
    this.randomUUID = 'random-uuid'
    this.dumpPath = '/dump'

    this.docPath = this.newDocPath = '/folder/doc.tex'
    this.filePath = this.newFilePath = '/folder/file.png'

    this.existingDocPath = '/folder/other.tex'
    this.existingFilePath = '/folder/fig1.pdf'

    this.linkedFileData = { provider: 'url' }

    this.existingDocs = [{ path: '/main.tex' }, { path: '/folder/other.tex' }]
    this.existingFiles = [{ path: '/figure.pdf' }, { path: '/folder/fig1.pdf' }]

    this.fsPath = `${this.dumpPath}/${this.projectId}_${this.randomUUID}`
    this.fileContents = `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{42}
\\author{Jane Doe}
\\date{June 2011}`
    this.docLines = this.fileContents.split('\n')
    this.source = 'dropbox'
    this.updateRequest = new Writable()
    this.writeStream = new Writable()

    this.fsPromises = {
      unlink: sinon.stub().resolves(),
      readFile: sinon.stub().withArgs(this.fsPath).resolves(this.fileContents),
      mkdir: sinon.stub().resolves(),
    }

    this.fs = {
      createWriteStream: sinon.stub().returns(this.writeStream),
    }

    this.doc = {
      _id: new ObjectId(),
      rev: 2,
    }

    this.file = {
      _id: new ObjectId(),
      rev: 6,
    }

    this.folder = {
      _id: new ObjectId(),
    }

    this.EditorController = {
      promises: {
        deleteEntityWithPath: sinon.stub().resolves(),
        upsertDocWithPath: sinon
          .stub()
          .resolves({ doc: this.doc, folder: this.folder }),
        upsertFileWithPath: sinon
          .stub()
          .resolves({ file: this.file, folder: this.folder }),
      },
    }

    this.FileTypeManager = {
      promises: {
        getType: sinon.stub(),
      },
    }

    this.crypto = {
      randomUUID: sinon.stub().returns(this.randomUUID),
    }

    this.ProjectEntityHandler = {
      promises: {
        getAllEntities: sinon.stub().resolves({
          docs: this.existingDocs,
          files: this.existingFiles,
        }),
      },
    }

    this.Settings = { path: { dumpFolder: this.dumpPath } }

    this.stream = { pipeline: sinon.stub().resolves() }

    this.UpdateMerger = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'fs/promises': this.fsPromises,
        fs: this.fs,
        '../Editor/EditorController': this.EditorController,
        '../Uploads/FileTypeManager': this.FileTypeManager,
        '../Project/ProjectEntityHandler': this.ProjectEntityHandler,
        '@overleaf/settings': this.Settings,
        'stream/promises': this.stream,
        crypto: this.crypto,
      },
    })
  })

  describe('mergeUpdate', function () {
    describe('doc updates for a new doc', function () {
      beforeEach(async function () {
        this.FileTypeManager.promises.getType.resolves({
          binary: false,
          encoding: 'utf-8',
        })
        await this.UpdateMerger.promises.mergeUpdate(
          this.userId,
          this.projectId,
          this.docPath,
          this.updateRequest,
          this.source
        )
      })

      it('should look at the file contents', function () {
        expect(this.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as doc', function () {
        expect(
          this.EditorController.promises.upsertDocWithPath
        ).to.have.been.calledWith(
          this.projectId,
          this.docPath,
          this.docLines,
          this.source,
          this.userId
        )
      })

      it('removes the temp file from disk', function () {
        expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
      })
    })

    describe('file updates for a new file ', function () {
      beforeEach(async function () {
        this.FileTypeManager.promises.getType.resolves({ binary: true })
        await this.UpdateMerger.promises.mergeUpdate(
          this.userId,
          this.projectId,
          this.filePath,
          this.updateRequest,
          this.source
        )
      })

      it('should look at the file contents', function () {
        expect(this.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as file', function () {
        expect(
          this.EditorController.promises.upsertFileWithPath
        ).to.have.been.calledWith(
          this.projectId,
          this.filePath,
          this.fsPath,
          null,
          this.source,
          this.userId
        )
      })

      it('removes the temp file from disk', function () {
        expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
      })
    })

    describe('doc updates for an existing doc', function () {
      beforeEach(async function () {
        this.FileTypeManager.promises.getType.resolves({
          binary: false,
          encoding: 'utf-8',
        })
        await this.UpdateMerger.promises.mergeUpdate(
          this.userId,
          this.projectId,
          this.existingDocPath,
          this.updateRequest,
          this.source
        )
      })

      it('should look at the file contents', function () {
        expect(this.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as doc', function () {
        expect(
          this.EditorController.promises.upsertDocWithPath
        ).to.have.been.calledWith(
          this.projectId,
          this.existingDocPath,
          this.docLines,
          this.source,
          this.userId
        )
      })

      it('removes the temp file from disk', function () {
        expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
      })
    })

    describe('file updates for an existing file', function () {
      beforeEach(async function () {
        this.FileTypeManager.promises.getType.resolves({ binary: true })
        await this.UpdateMerger.promises.mergeUpdate(
          this.userId,
          this.projectId,
          this.existingFilePath,
          this.updateRequest,
          this.source
        )
      })

      it('should look at the file contents', function () {
        expect(this.FileTypeManager.promises.getType).to.have.been.called
      })

      it('should process update as file', function () {
        expect(
          this.EditorController.promises.upsertFileWithPath
        ).to.have.been.calledWith(
          this.projectId,
          this.existingFilePath,
          this.fsPath,
          null,
          this.source,
          this.userId
        )
      })

      it('removes the temp file from disk', function () {
        expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
      })
    })
  })

  describe('file updates for an existing doc', function () {
    beforeEach(async function () {
      this.FileTypeManager.promises.getType.resolves({ binary: true })
      await this.UpdateMerger.promises.mergeUpdate(
        this.userId,
        this.projectId,
        this.existingDocPath,
        this.updateRequest,
        this.source
      )
    })

    it('should look at the file contents', function () {
      expect(this.FileTypeManager.promises.getType).to.have.been.called
    })

    it('should process update as file', function () {
      expect(
        this.EditorController.promises.upsertFileWithPath
      ).to.have.been.calledWith(
        this.projectId,
        this.existingDocPath,
        this.fsPath,
        null,
        this.source,
        this.userId
      )
    })

    it('removes the temp file from disk', function () {
      expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
    })
  })

  describe('doc updates for an existing file', function () {
    beforeEach(async function () {
      this.FileTypeManager.promises.getType.resolves({ binary: true })
      await this.UpdateMerger.promises.mergeUpdate(
        this.userId,
        this.projectId,
        this.existingFilePath,
        this.updateRequest,
        this.source
      )
    })

    it('should look at the file contents', function () {
      expect(this.FileTypeManager.promises.getType).to.have.been.called
    })

    it('should not delete the existing file', function () {
      expect(this.EditorController.promises.deleteEntityWithPath).to.not.have
        .been.called
    })

    it('should process update as file', function () {
      expect(
        this.EditorController.promises.upsertFileWithPath
      ).to.have.been.calledWith(
        this.projectId,
        this.existingFilePath,
        this.fsPath,
        null,
        this.source,
        this.userId
      )
    })

    it('removes the temp file from disk', function () {
      expect(this.fsPromises.unlink).to.have.been.calledWith(this.fsPath)
    })
  })

  describe('deleteUpdate', function () {
    beforeEach(async function () {
      await this.UpdateMerger.promises.deleteUpdate(
        this.userId,
        this.projectId,
        this.docPath,
        this.source
      )
    })

    it('should delete the entity in the editor controller', function () {
      expect(
        this.EditorController.promises.deleteEntityWithPath
      ).to.have.been.calledWith(
        this.projectId,
        this.docPath,
        this.source,
        this.userId
      )
    })
  })
})
