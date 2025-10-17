import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mockFs from 'mock-fs'
import mongodb from 'mongodb-legacy'
import Settings from '@overleaf/settings'

const { ObjectId } = mongodb

const MODULE_PATH =
  '../../../../app/src/Features/Uploads/FileSystemImportManager.mjs'

describe('FileSystemImportManager', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = new ObjectId()
    ctx.folderId = new ObjectId()
    ctx.newFolderId = new ObjectId()
    ctx.userId = new ObjectId()

    ctx.EditorController = {
      promises: {
        addDoc: sinon.stub().resolves(),
        addFile: sinon.stub().resolves(),
        upsertDoc: sinon.stub().resolves(),
        upsertFile: sinon.stub().resolves(),
        addFolder: sinon.stub().resolves({ _id: ctx.newFolderId }),
      },
    }

    vi.doMock('@overleaf/settings', () => ({
      default: {
        textExtensions: ['tex', 'txt'],
        editableFilenames: [
          'latexmkrc',
          '.latexmkrc',
          'makefile',
          'gnumakefile',
        ],
        fileIgnorePattern: Settings.fileIgnorePattern, // use the real pattern from the default settings
      },
    }))

    vi.doMock('../../../../app/src/Features/Editor/EditorController', () => ({
      default: ctx.EditorController,
    }))

    ctx.FileSystemImportManager = (await import(MODULE_PATH)).default
  })

  describe('importDir', function () {
    beforeEach(async function (ctx) {
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
      ctx.entries =
        await ctx.FileSystemImportManager.promises.importDir('import-test')
      ctx.projectPaths = ctx.entries.map(x => x.projectPath)
    })

    afterEach(function () {
      mockFs.restore()
    })

    it('should import regular docs', function (ctx) {
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/main.tex',
        lines: ['My thesis'],
      })
    })

    it('should skip symlinks inside the import folder', function (ctx) {
      expect(ctx.projectPaths).not.to.include('/link-to-main.tex')
    })

    it('should skip ignored files', function (ctx) {
      expect(ctx.projectPaths).not.to.include('/.DS_Store')
    })

    it('should import binary files', function (ctx) {
      expect(ctx.entries).to.deep.include({
        type: 'file',
        projectPath: '/images/cat.jpg',
        fsPath: 'import-test/images/cat.jpg',
      })
    })

    it('should deal with Mac/Windows/Unix line endings', function (ctx) {
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/unix.txt',
        lines: ['one', 'two', 'three'],
      })
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/mac.txt',
        lines: ['uno', 'dos', 'tres'],
      })
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/windows.txt',
        lines: ['ein', 'zwei', 'drei'],
      })
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/line-endings/mixed.txt',
        lines: ['uno', 'due', 'tre', 'quattro'],
      })
    })

    it('should import documents with latin1 encoding', function (ctx) {
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/encodings/latin1.txt',
        lines: ['tétanisant!'],
      })
    })

    it('should import documents with utf16-le encoding', function (ctx) {
      expect(ctx.entries).to.deep.include({
        type: 'doc',
        projectPath: '/encodings/utf16le.txt',
        lines: ['\ufeffétonnant!'],
      })
    })

    it('should error when the root folder is a symlink', async function (ctx) {
      await expect(ctx.FileSystemImportManager.promises.importDir('symlink')).to
        .be.rejected
    })
  })

  describe('addEntity', function () {
    describe('with directory', function () {
      beforeEach(async function (ctx) {
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

        await ctx.FileSystemImportManager.promises.addEntity(
          ctx.userId,
          ctx.projectId,
          ctx.folderId,
          'folder',
          'path/to/folder',
          false
        )
      })

      afterEach(function () {
        mockFs.restore()
      })

      it('should add a folder to the project', function (ctx) {
        ctx.EditorController.promises.addFolder.should.have.been.calledWith(
          ctx.projectId,
          ctx.folderId,
          'folder',
          'upload'
        )
      })

      it("should add the folder's contents", function (ctx) {
        ctx.EditorController.promises.addDoc.should.have.been.calledWith(
          ctx.projectId,
          ctx.newFolderId,
          'doc.tex',
          ['one', 'two', 'three'],
          'upload',
          ctx.userId
        )
        ctx.EditorController.promises.addFile.should.have.been.calledWith(
          ctx.projectId,
          ctx.newFolderId,
          'image.jpg',
          'path/to/folder/image.jpg',
          null,
          'upload',
          ctx.userId
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
        beforeEach(async function (ctx) {
          await ctx.FileSystemImportManager.promises.addEntity(
            ctx.userId,
            ctx.projectId,
            ctx.folderId,
            'image.jpg',
            'uploaded-file',
            false
          )
        })

        it('should add the file', function (ctx) {
          ctx.EditorController.promises.addFile.should.have.been.calledWith(
            ctx.projectId,
            ctx.folderId,
            'image.jpg',
            'uploaded-file',
            null,
            'upload',
            ctx.userId
          )
        })
      })

      describe('with replace set to true', function () {
        beforeEach(async function (ctx) {
          await ctx.FileSystemImportManager.promises.addEntity(
            ctx.userId,
            ctx.projectId,
            ctx.folderId,
            'image.jpg',
            'uploaded-file',
            true
          )
        })

        it('should add the file', function (ctx) {
          ctx.EditorController.promises.upsertFile.should.have.been.calledWith(
            ctx.projectId,
            ctx.folderId,
            'image.jpg',
            'uploaded-file',
            null,
            'upload',
            ctx.userId
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
          beforeEach(async function (ctx) {
            await ctx.FileSystemImportManager.promises.addEntity(
              ctx.userId,
              ctx.projectId,
              ctx.folderId,
              'doc.tex',
              'path/to/uploaded-file',
              false
            )
          })

          it('should insert the doc', function (ctx) {
            ctx.EditorController.promises.addDoc.should.have.been.calledWith(
              ctx.projectId,
              ctx.folderId,
              'doc.tex',
              ['one', 'two', 'three'],
              'upload',
              ctx.userId
            )
          })
        })

        describe('with replace set to true', function () {
          beforeEach(async function (ctx) {
            await ctx.FileSystemImportManager.promises.addEntity(
              ctx.userId,
              ctx.projectId,
              ctx.folderId,
              'doc.tex',
              'path/to/uploaded-file',
              true
            )
          })

          it('should upsert the doc', function (ctx) {
            ctx.EditorController.promises.upsertDoc.should.have.been.calledWith(
              ctx.projectId,
              ctx.folderId,
              'doc.tex',
              ['one', 'two', 'three'],
              'upload',
              ctx.userId
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

      it('should stop with an error', async function (ctx) {
        await expect(
          ctx.FileSystemImportManager.promises.addEntity(
            ctx.userId,
            ctx.projectId,
            ctx.folderId,
            'main.tex',
            'path/to/symlink',
            false
          )
        ).to.be.rejectedWith('path is symlink')
        ctx.EditorController.promises.addFolder.should.not.have.been.called
        ctx.EditorController.promises.addDoc.should.not.have.been.called
        ctx.EditorController.promises.addFile.should.not.have.been.called
      })
    })
  })
})
