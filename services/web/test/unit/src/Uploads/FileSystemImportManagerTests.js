/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const modulePath =
  '../../../../app/src/Features/Uploads/FileSystemImportManager.js'
const SandboxedModule = require('sandboxed-module')

describe('FileSystemImportManager', function() {
  beforeEach(function() {
    this.project_id = 'project-id-123'
    this.folder_id = 'folder-id-123'
    this.name = 'test-file.tex'
    this.path_on_disk = `/path/to/file/${this.name}`
    this.replace = 'replace-boolean-flag-mock'
    this.user_id = 'mock-user-123'
    this.callback = sinon.stub()
    this.encoding = 'latin1'
    this.DocumentHelper = {
      convertTexEncodingsToUtf8: sinon.stub().returnsArg(0)
    }
    return (this.FileSystemImportManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        fs: (this.fs = {}),
        '../Editor/EditorController': (this.EditorController = {}),
        './FileTypeManager': (this.FileTypeManager = {}),
        '../Project/ProjectLocator': (this.ProjectLocator = {}),
        '../Documents/DocumentHelper': this.DocumentHelper,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    }))
  })

  describe('addDoc', function() {
    beforeEach(function() {
      this.docContent = 'one\ntwo\nthree'
      this.docLines = this.docContent.split('\n')
      this.fs.readFile = sinon.stub().callsArgWith(2, null, this.docContent)
      return (this.FileSystemImportManager._isSafeOnFileSystem = sinon
        .stub()
        .callsArgWith(1, null, true))
    })

    describe('when path is symlink', function() {
      beforeEach(function() {
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.EditorController.addDoc = sinon.stub()
        return this.FileSystemImportManager.addDoc(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.encoding,
          false,
          this.callback
        )
      })

      it('should not read the file from disk', function() {
        return this.fs.readFile.called.should.equal(false)
      })

      it('should not insert the doc', function() {
        return this.EditorController.addDoc.called.should.equal(false)
      })
    })

    describe('with replace set to false', function() {
      beforeEach(function() {
        this.EditorController.addDoc = sinon.stub().callsArg(6)
        return this.FileSystemImportManager.addDoc(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.encoding,
          false,
          this.callback
        )
      })

      it('should read the file from disk', function() {
        return this.fs.readFile.calledWith(this.path_on_disk).should.equal(true)
      })

      it('should insert the doc', function() {
        return this.EditorController.addDoc
          .calledWith(
            this.project_id,
            this.folder_id,
            this.name,
            this.docLines,
            'upload',
            this.user_id
          )
          .should.equal(true)
      })
    })

    describe('with windows line ending', function() {
      beforeEach(function() {
        this.docContent = 'one\r\ntwo\r\nthree'
        this.docLines = ['one', 'two', 'three']
        this.fs.readFile = sinon.stub().callsArgWith(2, null, this.docContent)
        this.EditorController.addDoc = sinon.stub().callsArg(6)
        return this.FileSystemImportManager.addDoc(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.encoding,
          false,
          this.callback
        )
      })

      it('should strip the \\r characters before adding', function() {
        return this.EditorController.addDoc
          .calledWith(
            this.project_id,
            this.folder_id,
            this.name,
            this.docLines,
            'upload',
            this.user_id
          )
          .should.equal(true)
      })
    })

    describe('with \r line endings', function() {
      beforeEach(function() {
        this.docContent = 'one\rtwo\rthree'
        this.docLines = ['one', 'two', 'three']
        this.fs.readFile = sinon.stub().callsArgWith(2, null, this.docContent)
        this.EditorController.addDoc = sinon.stub().callsArg(6)
        return this.FileSystemImportManager.addDoc(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.encoding,
          false,
          this.callback
        )
      })

      it('should treat the \\r characters as newlines', function() {
        return this.EditorController.addDoc
          .calledWith(
            this.project_id,
            this.folder_id,
            this.name,
            this.docLines,
            'upload',
            this.user_id
          )
          .should.equal(true)
      })
    })

    describe('with replace set to true', function() {
      beforeEach(function() {
        this.EditorController.upsertDoc = sinon.stub().yields()
        return this.FileSystemImportManager.addDoc(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.encoding,
          true,
          this.callback
        )
      })

      it('should upsert the doc', function() {
        return this.EditorController.upsertDoc
          .calledWith(
            this.project_id,
            this.folder_id,
            this.name,
            this.docLines,
            'upload',
            this.user_id
          )
          .should.equal(true)
      })

      it('should read the file with the correct encoding', function() {
        return sinon.assert.calledWith(
          this.fs.readFile,
          this.path_on_disk,
          this.encoding
        )
      })
    })
  })

  describe('addFile with replace set to false', function() {
    beforeEach(function() {
      this.EditorController.addFile = sinon.stub().yields()
      this.FileSystemImportManager._isSafeOnFileSystem = sinon
        .stub()
        .callsArgWith(1, null, true)
      return this.FileSystemImportManager.addFile(
        this.user_id,
        this.project_id,
        this.folder_id,
        this.name,
        this.path_on_disk,
        false,
        this.callback
      )
    })

    it('should add the file', function() {
      return this.EditorController.addFile
        .calledWith(
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          null,
          'upload',
          this.user_id
        )
        .should.equal(true)
    })
  })

  describe('addFile with symlink', function() {
    beforeEach(function() {
      this.EditorController.addFile = sinon.stub()
      this.FileSystemImportManager._isSafeOnFileSystem = sinon
        .stub()
        .callsArgWith(1, null, false)
      this.EditorController.replaceFile = sinon.stub()
      return this.FileSystemImportManager.addFile(
        this.user_id,
        this.project_id,
        this.folder_id,
        this.name,
        this.path_on_disk,
        false,
        this.callback
      )
    })

    it('should node add the file', function() {
      this.EditorController.addFile.called.should.equal(false)
      return this.EditorController.replaceFile.called.should.equal(false)
    })
  })

  describe('addFile with replace set to true', function() {
    beforeEach(function() {
      this.FileSystemImportManager._isSafeOnFileSystem = sinon
        .stub()
        .callsArgWith(1, null, true)
      this.EditorController.upsertFile = sinon.stub().yields()
      return this.FileSystemImportManager.addFile(
        this.user_id,
        this.project_id,
        this.folder_id,
        this.name,
        this.path_on_disk,
        true,
        this.callback
      )
    })

    it('should add the file', function() {
      return this.EditorController.upsertFile
        .calledWith(
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          null,
          'upload',
          this.user_id
        )
        .should.equal(true)
    })
  })

  describe('addFolder', function() {
    beforeEach(function() {
      this.new_folder_id = 'new-folder-id'
      this.EditorController.addFolder = sinon
        .stub()
        .callsArgWith(4, null, { _id: this.new_folder_id })
      return (this.FileSystemImportManager.addFolderContents = sinon
        .stub()
        .callsArg(5))
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, true)
        return this.FileSystemImportManager.addFolder(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.replace,
          this.callback
        )
      })

      it('should add a folder to the project', function() {
        return this.EditorController.addFolder
          .calledWith(this.project_id, this.folder_id, this.name, 'upload')
          .should.equal(true)
      })

      it('should add the folders contents', function() {
        return this.FileSystemImportManager.addFolderContents
          .calledWith(
            this.user_id,
            this.project_id,
            this.new_folder_id,
            this.path_on_disk,
            this.replace
          )
          .should.equal(true)
      })
    })

    describe('with symlink', function() {
      beforeEach(function() {
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, false)
        return this.FileSystemImportManager.addFolder(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.replace,
          this.callback
        )
      })

      it('should not add a folder to the project', function() {
        this.EditorController.addFolder.called.should.equal(false)
        return this.FileSystemImportManager.addFolderContents.called.should.equal(
          false
        )
      })
    })
  })

  describe('addFolderContents', function() {
    beforeEach(function() {
      this.folderEntries = ['path1', 'path2', 'path3']
      this.ignoredEntries = ['.DS_Store']
      this.fs.readdir = sinon
        .stub()
        .callsArgWith(1, null, this.folderEntries.concat(this.ignoredEntries))
      this.FileSystemImportManager.addEntity = sinon.stub().callsArg(6)
      this.FileTypeManager.shouldIgnore = (path, callback) => {
        return callback(
          null,
          this.ignoredEntries.indexOf(require('path').basename(path)) !== -1
        )
      }
      this.FileSystemImportManager._isSafeOnFileSystem = sinon
        .stub()
        .callsArgWith(1, null, true)
      return this.FileSystemImportManager.addFolderContents(
        this.user_id,
        this.project_id,
        this.folder_id,
        this.path_on_disk,
        this.replace,
        this.callback
      )
    })

    it('should call addEntity for each file in the folder which is not ignored', function() {
      return Array.from(this.folderEntries).map(name =>
        this.FileSystemImportManager.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            name,
            `${this.path_on_disk}/${name}`,
            this.replace
          )
          .should.equal(true)
      )
    })

    it('should not call addEntity for the ignored files', function() {
      return Array.from(this.ignoredEntries).map(name =>
        this.FileSystemImportManager.addEntity
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            name,
            `${this.path_on_disk}/${name}`,
            this.replace
          )
          .should.equal(false)
      )
    })

    it('should look in the correct directory', function() {
      return this.fs.readdir.calledWith(this.path_on_disk).should.equal(true)
    })
  })

  describe('addEntity', function() {
    describe('with directory', function() {
      beforeEach(function() {
        this.FileTypeManager.isDirectory = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.FileSystemImportManager.addFolder = sinon.stub().callsArg(6)
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, true)
        return this.FileSystemImportManager.addEntity(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.replace,
          this.callback
        )
      })

      it('should call addFolder', function() {
        return this.FileSystemImportManager.addFolder
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            this.name,
            this.path_on_disk,
            this.replace
          )
          .should.equal(true)
      })
    })

    describe('with binary file', function() {
      beforeEach(function() {
        this.FileTypeManager.isDirectory = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.FileTypeManager.getType = sinon.stub().callsArgWith(2, null, true)
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, true)
        this.FileSystemImportManager.addFile = sinon.stub().callsArg(6)
        return this.FileSystemImportManager.addEntity(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.replace,
          this.callback
        )
      })

      it('should call addFile', function() {
        return this.FileSystemImportManager.addFile
          .calledWith(
            this.user_id,
            this.project_id,
            this.folder_id,
            this.name,
            this.path_on_disk,
            this.replace
          )
          .should.equal(true)
      })
    })

    describe('with text file', function() {
      beforeEach(function() {
        this.FileTypeManager.isDirectory = sinon
          .stub()
          .callsArgWith(1, null, false)
        this.FileTypeManager.getType = sinon
          .stub()
          .callsArgWith(2, null, false, 'latin1')
        this.FileSystemImportManager.addDoc = sinon.stub().callsArg(7)
        this.FileSystemImportManager._isSafeOnFileSystem = sinon
          .stub()
          .callsArgWith(1, null, true)
        return this.FileSystemImportManager.addEntity(
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          this.replace,
          this.callback
        )
      })

      it('should call addFile', function() {
        return sinon.assert.calledWith(
          this.FileSystemImportManager.addDoc,
          this.user_id,
          this.project_id,
          this.folder_id,
          this.name,
          this.path_on_disk,
          'latin1',
          this.replace
        )
      })
    })
  })
})
