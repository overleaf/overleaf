const sinon = require('sinon')
const { expect } = require('chai')
const mockFs = require('mock-fs')
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb-legacy')
const Settings = require('@overleaf/settings')

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/FileSystemImportManager.js'

describe('FileSystemImportManager', function () {
  beforeEach(function () {
    this.projectId = new ObjectId()
    this.folderId = new ObjectId()
    this.newFolderId = new ObjectId()
    this.userId = new ObjectId()

    this.EditorController = {
      promises: {
        addDoc: sinon.stub().resolves(),
        addFile: sinon.stub().resolves(),
        upsertDoc: sinon.stub().resolves(),
        upsertFile: sinon.stub().resolves(),
        addFolder: sinon.stub().resolves({ _id: this.newFolderId }),
      },
    }
    this.FileSystemImportManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        '@overleaf/settings': {
          textExtensions: ['tex', 'txt'],
          editableFilenames: [
            'latexmkrc',
            '.latexmkrc',
            'makefile',
            'gnumakefile',
          ],
          fileIgnorePattern: Settings.fileIgnorePattern, // use the real pattern from the default settings
        },
        '../Editor/EditorController': this.EditorController,
      },
    })
  })

  describe('importDir', function () {
    beforeEach(async function () {
      mockFs({
        'import-test': {
          'main.tex': 'My thesis',
          'link-to-main.tex': mockFs.symlink({ path: 'import-test/main.tex' }),
          '.DS_Store': 'Should be ignored',
          images: {
            'cat.jpg': Buffer.from([1, 2, 3, 4]),
          },
          'line-endings': {
            'unix.txt': 'one\ntwo\nthree',
            'mac.txt': 'uno\rdos\rtres',
            'windows.txt': 'ein\r\nzwei\r\ndrei',
            'mixed.txt': 'uno\rdue\r\ntre\nquattro',
          },
          encodings: {
            'utf16le.txt': Buffer.from('\ufeffétonnant!', 'utf16le'),
            'latin1.txt': Buffer.from('tétanisant!', 'latin1'),
          },
        },
        symlink: mockFs.symlink({ path: 'import-test' }),
      })
      this.entries =
        await this.FileSystemImportManager.promises.importDir('import-test')
      this.projectPaths = this.entries.map(x => x.projectPath)
    })

    afterEach(function () {
      mockFs.restore()
    })

    it('should import regular docs', function () {
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/main.tex',
        lines: ['My thesis'],
      })
    })

    it('should skip symlinks inside the import folder', function () {
      expect(this.projectPaths).not.to.include('/link-to-main.tex')
    })

    it('should skip ignored files', function () {
      expect(this.projectPaths).not.to.include('/.DS_Store')
    })

    it('should import binary files', function () {
      expect(this.entries).to.deep.include({
        type: 'file',
        projectPath: '/images/cat.jpg',
        fsPath: 'import-test/images/cat.jpg',
      })
    })

    it('should deal with Mac/Windows/Unix line endings', function () {
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/unix.txt',
        lines: ['one', 'two', 'three'],
      })
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/mac.txt',
        lines: ['uno', 'dos', 'tres'],
      })
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/windows.txt',
        lines: ['ein', 'zwei', 'drei'],
      })
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/mixed.txt',
        lines: ['uno', 'due', 'tre', 'quattro'],
      })
    })

    it('should import documents with latin1 encoding', function () {
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/encodings/latin1.txt',
        lines: ['tétanisant!'],
      })
    })

    it('should import documents with utf16-le encoding', function () {
      expect(this.entries).to.deep.include({
        type: 'doc',
        projectPath: '/encodings/utf16le.txt',
        lines: ['\ufeffétonnant!'],
      })
    })

    it('should error when the root folder is a symlink', async function () {
      await expect(this.FileSystemImportManager.promises.importDir('symlink'))
        .to.be.rejected
    })
  })

  describe('addEntity', function () {
    describe('with directory', function () {
      beforeEach(async function () {
        mockFs({
          path: {
            to: {
              folder: {
                'doc.tex': 'one\ntwo\nthree',
                'image.jpg': Buffer.from([1, 2, 3, 4]),
              },
            },
          },
        })

        await this.FileSystemImportManager.promises.addEntity(
          this.userId,
          this.projectId,
          this.folderId,
          'folder',
          'path/to/folder',
          false
        )
      })

      afterEach(function () {
        mockFs.restore()
      })

      it('should add a folder to the project', function () {
        this.EditorController.promises.addFolder.should.have.been.calledWith(
          this.projectId,
          this.folderId,
          'folder',
          'upload'
        )
      })

      it("should add the folder's contents", function () {
        this.EditorController.promises.addDoc.should.have.been.calledWith(
          this.projectId,
          this.newFolderId,
          'doc.tex',
          ['one', 'two', 'three'],
          'upload',
          this.userId
        )
        this.EditorController.promises.addFile.should.have.been.calledWith(
          this.projectId,
          this.newFolderId,
          'image.jpg',
          'path/to/folder/image.jpg',
          null,
          'upload',
          this.userId
        )
      })
    })

    describe('with binary file', function () {
      beforeEach(function () {
        mockFs({ 'uploaded-file': Buffer.from([1, 2, 3, 4]) })
      })

      afterEach(function () {
        mockFs.restore()
      })

      describe('with replace set to false', function () {
        beforeEach(async function () {
          await this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            'image.jpg',
            'uploaded-file',
            false
          )
        })

        it('should add the file', function () {
          this.EditorController.promises.addFile.should.have.been.calledWith(
            this.projectId,
            this.folderId,
            'image.jpg',
            'uploaded-file',
            null,
            'upload',
            this.userId
          )
        })
      })

      describe('with replace set to true', function () {
        beforeEach(async function () {
          await this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            'image.jpg',
            'uploaded-file',
            true
          )
        })

        it('should add the file', function () {
          this.EditorController.promises.upsertFile.should.have.been.calledWith(
            this.projectId,
            this.folderId,
            'image.jpg',
            'uploaded-file',
            null,
            'upload',
            this.userId
          )
        })
      })
    })

    for (const [lineEndingDescription, lineEnding] of [
      ['Unix', '\n'],
      ['Mac', '\r'],
      ['Windows', '\r\n'],
    ]) {
      describe(`with text file (${lineEndingDescription} line endings)`, function () {
        beforeEach(function () {
          mockFs({
            path: {
              to: { 'uploaded-file': `one${lineEnding}two${lineEnding}three` },
            },
          })
        })

        afterEach(function () {
          mockFs.restore()
        })

        describe('with replace set to false', function () {
          beforeEach(async function () {
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              'doc.tex',
              'path/to/uploaded-file',
              false
            )
          })

          it('should insert the doc', function () {
            this.EditorController.promises.addDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              'doc.tex',
              ['one', 'two', 'three'],
              'upload',
              this.userId
            )
          })
        })

        describe('with replace set to true', function () {
          beforeEach(async function () {
            await this.FileSystemImportManager.promises.addEntity(
              this.userId,
              this.projectId,
              this.folderId,
              'doc.tex',
              'path/to/uploaded-file',
              true
            )
          })

          it('should upsert the doc', function () {
            this.EditorController.promises.upsertDoc.should.have.been.calledWith(
              this.projectId,
              this.folderId,
              'doc.tex',
              ['one', 'two', 'three'],
              'upload',
              this.userId
            )
          })
        })
      })
    }

    describe('with symlink', function () {
      beforeEach(function () {
        mockFs({
          path: { to: { symlink: mockFs.symlink({ path: '/etc/passwd' }) } },
        })
      })

      afterEach(function () {
        mockFs.restore()
      })

      it('should stop with an error', async function () {
        await expect(
          this.FileSystemImportManager.promises.addEntity(
            this.userId,
            this.projectId,
            this.folderId,
            'main.tex',
            'path/to/symlink',
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
