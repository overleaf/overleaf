const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/FileSystemImportManager.js'

describe('FileSystemImportManager', function() {
  beforeEach(function() {
    this.projectId = new ObjectId()
    this.folderId = new ObjectId()
    this.newFolderId = new ObjectId()
    this.userId = new ObjectId()

    this.folderPath = '/path/to/folder'
    this.docName = 'test-doc.tex'
    this.docPath = `/path/to/folder/${this.docName}`
    this.docContent = 'one\ntwo\nthree'
    this.docLines = this.docContent.split('\n')
    this.fileName = 'test-file.jpg'
    this.filePath = `/path/to/folder/${this.fileName}`
    this.symlinkName = 'symlink'
    this.symlinkPath = `/path/to/${this.symlinkName}`
    this.ignoredName = '.DS_Store'
    this.ignoredPath = `/path/to/folder/${this.ignoredName}`
    this.folderEntries = [this.ignoredName, this.docName, this.fileName]

    this.encoding = 'latin1'

    this.fileStat = {
      isFile: sinon.stub().returns(true),
      isDirectory: sinon.stub().returns(false)
    }
    this.dirStat = {
      isFile: sinon.stub().returns(false),
      isDirectory: sinon.stub().returns(true)
    }
    this.symlinkStat = {
      isFile: sinon.stub().returns(false),
      isDirectory: sinon.stub().returns(false)
    }
    this.fs = {
      promises: {
        lstat: sinon.stub(),
        readFile: sinon.stub(),
        readdir: sinon.stub()
      }
    }
    this.fs.promises.lstat.withArgs(this.filePath).resolves(this.fileStat)
    this.fs.promises.lstat.withArgs(this.docPath).resolves(this.fileStat)
    this.fs.promises.lstat.withArgs(this.symlinkPath).resolves(this.symlinkStat)
    this.fs.promises.lstat.withArgs(this.folderPath).resolves(this.dirStat)
    this.fs.promises.readFile
      .withArgs(this.docPath, this.encoding)
      .resolves(this.docContent)
    this.fs.promises.readdir
      .withArgs(this.folderPath)
      .resolves(this.folderEntries)
    this.EditorController = {
      promises: {
        addDoc: sinon.stub().resolves(),
        addFile: sinon.stub().resolves(),
        upsertDoc: sinon.stub().resolves(),
        upsertFile: sinon.stub().resolves(),
        addFolder: sinon.stub().resolves({ _id: this.newFolderId })
      }
    }
    this.FileTypeManager = {
      promises: {
        isDirectory: sinon.stub().resolves(false),
        getType: sinon.stub(),
        shouldIgnore: sinon.stub().resolves(false)
      }
    }
    this.FileTypeManager.promises.getType
      .withArgs(this.fileName, this.filePath)
      .resolves({ binary: true })
    this.FileTypeManager.promises.getType
      .withArgs(this.docName, this.docPath)
      .resolves({ binary: false, encoding: this.encoding })
    this.FileTypeManager.promises.isDirectory
      .withArgs(this.folderPath)
      .resolves(true)
    this.FileTypeManager.promises.shouldIgnore
      .withArgs(this.ignoredName)
      .resolves(true)
    this.logger = {
      log() {},
      err() {}
    }
    this.FileSystemImportManager = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        fs: this.fs,
        '../Editor/EditorController': this.EditorController,
        './FileTypeManager': this.FileTypeManager,
        'logger-sharelatex': this.logger
      }
    })
  })

  describe('addFolderContents', function() {
    describe('successfully', function() {
      beforeEach(async function() {
        await this.FileSystemImportManager.promises.addFolderContents(
          this.userId,
          this.projectId,
          this.folderId,
          this.folderPath,
          false
        )
      })

      it('should add each file in the folder which is not ignored', function() {
        this.EditorController.promises.addDoc.should.have.been.calledWith(
          this.projectId,
          this.folderId,
          this.docName,
          this.docLines,
          'upload',
          this.userId
        )
        this.EditorController.promises.addFile.should.have.been.calledWith(
          this.projectId,
          this.folderId,
          this.fileName,
          this.filePath,
          null,
          'upload',
          this.userId
        )
      })
    })

    describe('with symlink', function() {
      it('should stop with an error', async function() {
        await expect(
          this.FileSystemImportManager.promises.addFolderContents(
            this.userId,
            this.projectId,
            this.folderId,
            this.symlinkPath,
            false
          )
        ).to.be.rejectedWith('path is symlink')
        this.EditorController.promises.addFolder.should.not.have.been.called
        this.EditorController.promises.addDoc.should.not.have.been.called
        this.EditorController.promises.addFile.should.not.have.been.called
      })
    })
  })

  describe('addEntity', function() {
    describe('with directory', function() {
      describe('successfully', function() {
        beforeEach(async function() {
          await this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            this.folderName,
            this.folderPath,
            false
          )
        })

        it('should add a folder to the project', function() {
          this.EditorController.promises.addFolder.should.have.been.calledWith(
            this.projectId,
            this.folderId,
            this.folderName,
            'upload'
          )
        })

        it("should add the folder's contents", function() {
          this.EditorController.promises.addDoc.should.have.been.calledWith(
            this.projectId,
            this.newFolderId,
            this.docName,
            this.docLines,
            'upload',
            this.userId
          )
          this.EditorController.promises.addFile.should.have.been.calledWith(
            this.projectId,
            this.newFolderId,
            this.fileName,
            this.filePath,
            null,
            'upload',
            this.userId
          )
        })
      })
    })

    describe('with binary file', function() {
      describe('with replace set to false', function() {
        beforeEach(async function() {
          await this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            this.fileName,
            this.filePath,
            false
          )
        })

        it('should add the file', function() {
          this.EditorController.promises.addFile.should.have.been.calledWith(
            this.projectId,
            this.folderId,
            this.fileName,
            this.filePath,
            null,
            'upload',
            this.userId
          )
        })
      })

      describe('with replace set to true', function() {
        beforeEach(async function() {
          await this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            this.fileName,
            this.filePath,
            true
          )
        })

        it('should add the file', function() {
          this.EditorController.promises.upsertFile.should.have.been.calledWith(
            this.projectId,
            this.folderId,
            this.fileName,
            this.filePath,
            null,
            'upload',
            this.userId
          )
        })
      })

      describe('with text file', function() {
        describe('with replace set to false', function() {
          beforeEach(async function() {
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              this.docName,
              this.docPath,
              false
            )
          })

          it('should insert the doc', function() {
            this.EditorController.promises.addDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              this.docName,
              this.docLines,
              'upload',
              this.userId
            )
          })
        })

        describe('with windows line ending', function() {
          beforeEach(async function() {
            this.docContent = 'one\r\ntwo\r\nthree'
            this.docLines = ['one', 'two', 'three']
            this.fs.promises.readFile
              .withArgs(this.docPath, this.encoding)
              .resolves(this.docContent)
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              this.docName,
              this.docPath,
              false
            )
          })

          it('should strip the \\r characters before adding', function() {
            this.EditorController.promises.addDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              this.docName,
              this.docLines,
              'upload',
              this.userId
            )
          })
        })

        describe('with \r line endings', function() {
          beforeEach(async function() {
            this.docContent = 'one\rtwo\rthree'
            this.docLines = ['one', 'two', 'three']
            this.fs.promises.readFile
              .withArgs(this.docPath, this.encoding)
              .resolves(this.docContent)
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              this.docName,
              this.docPath,
              false
            )
          })

          it('should treat the \\r characters as newlines', function() {
            this.EditorController.promises.addDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              this.docName,
              this.docLines,
              'upload',
              this.userId
            )
          })
        })

        describe('with replace set to true', function() {
          beforeEach(async function() {
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              this.docName,
              this.docPath,
              true
            )
          })

          it('should upsert the doc', function() {
            this.EditorController.promises.upsertDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              this.docName,
              this.docLines,
              'upload',
              this.userId
            )
          })
        })
      })
    })

    describe('with symlink', function() {
      it('should stop with an error', async function() {
        await expect(
          this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            this.symlinkName,
            this.symlinkPath,
            false
          )
        ).to.be.rejectedWith('path is symlink')
        this.EditorController.promises.addFolder.should.not.have.been.called
        this.EditorController.promises.addDoc.should.not.have.been.called
        this.EditorController.promises.addFile.should.not.have.been.called
      })
    })
  })
})
