/* eslint-disable
    handle-callback-err,
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
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const { expect } = require('chai')

const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/Editor/EditorController'
)
const MockClient = require('../helpers/MockClient')
const assert = require('assert')

describe('EditorController', function() {
  beforeEach(function() {
    this.project_id = 'test-project-id'
    this.source = 'dropbox'

    this.doc = { _id: (this.doc_id = 'test-doc-id') }
    this.docName = 'doc.tex'
    this.docLines = ['1234', 'dskl']
    this.file = { _id: (this.file_id = 'dasdkjk') }
    this.fileName = 'file.png'
    this.fsPath = '/folder/file.png'
    this.linkedFileData = { provider: 'url' }

    this.newFile = { _id: 'new-file-id' }

    this.folder_id = '123ksajdn'
    this.folder = { _id: this.folder_id }
    this.folderName = 'folder'

    this.callback = sinon.stub()

    return (this.EditorController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Project/ProjectEntityUpdateHandler': (this.ProjectEntityUpdateHandler = {}),
        '../Project/ProjectOptionsHandler': (this.ProjectOptionsHandler = {
          setCompiler: sinon.stub().yields(),
          setImageName: sinon.stub().yields(),
          setSpellCheckLanguage: sinon.stub().yields()
        }),
        '../Project/ProjectDetailsHandler': (this.ProjectDetailsHandler = {
          setProjectDescription: sinon.stub().yields(),
          renameProject: sinon.stub().yields(),
          setPublicAccessLevel: sinon.stub().yields()
        }),
        '../Project/ProjectDeleter': (this.ProjectDeleter = {}),
        '../DocumentUpdater/DocumentUpdaterHandler': (this.DocumentUpdaterHandler = {
          flushDocToMongo: sinon.stub().yields(),
          setDocument: sinon.stub().yields()
        }),
        './EditorRealTimeController': (this.EditorRealTimeController = {
          emitToRoom: sinon.stub()
        }),
        'metrics-sharelatex': (this.Metrics = { inc: sinon.stub() }),
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          err: sinon.stub()
        })
      }
    }))
  })

  describe('addDoc', function() {
    beforeEach(function() {
      this.ProjectEntityUpdateHandler.addDocWithRanges = sinon
        .stub()
        .yields(null, this.doc, this.folder_id)
      return this.EditorController.addDoc(
        this.project_id,
        this.folder_id,
        this.docName,
        this.docLines,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('should add the doc using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.addDocWithRanges
        .calledWith(
          this.project_id,
          this.folder_id,
          this.docName,
          this.docLines,
          {}
        )
        .should.equal(true)
    })

    it('should send the update out to the users in the project', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'reciveNewDoc',
          this.folder_id,
          this.doc,
          this.source
        )
        .should.equal(true)
    })

    it('calls the callback', function() {
      return this.callback.calledWith(null, this.doc).should.equal(true)
    })
  })

  describe('addFile', function() {
    beforeEach(function() {
      this.ProjectEntityUpdateHandler.addFile = sinon
        .stub()
        .yields(null, this.file, this.folder_id)
      return this.EditorController.addFile(
        this.project_id,
        this.folder_id,
        this.fileName,
        this.fsPath,
        this.linkedFileData,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('should add the folder using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.addFile
        .calledWith(
          this.project_id,
          this.folder_id,
          this.fileName,
          this.fsPath,
          this.linkedFileData,
          this.user_id
        )
        .should.equal(true)
    })

    it('should send the update of a new folder out to the users in the project', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'reciveNewFile',
          this.folder_id,
          this.file,
          this.source,
          this.linkedFileData
        )
        .should.equal(true)
    })

    it('calls the callback', function() {
      return this.callback.calledWith(null, this.file).should.equal(true)
    })
  })

  describe('upsertDoc', function() {
    beforeEach(function() {
      this.ProjectEntityUpdateHandler.upsertDoc = sinon
        .stub()
        .yields(null, this.doc, false)
      return this.EditorController.upsertDoc(
        this.project_id,
        this.folder_id,
        this.docName,
        this.docLines,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('upserts the doc using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.upsertDoc
        .calledWith(
          this.project_id,
          this.folder_id,
          this.docName,
          this.docLines,
          this.source
        )
        .should.equal(true)
    })

    it('returns the doc', function() {
      return this.callback.calledWith(null, this.doc).should.equal(true)
    })

    describe('doc does not exist', function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.upsertDoc = sinon
          .stub()
          .yields(null, this.doc, true)
        return this.EditorController.upsertDoc(
          this.project_id,
          this.folder_id,
          this.docName,
          this.docLines,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('sends an update out to users in the project', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewDoc',
            this.folder_id,
            this.doc,
            this.source
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertFile', function() {
    beforeEach(function() {
      this.ProjectEntityUpdateHandler.upsertFile = sinon
        .stub()
        .yields(null, this.newFile, false, this.file)
      return this.EditorController.upsertFile(
        this.project_id,
        this.folder_id,
        this.fileName,
        this.fsPath,
        this.linkedFileData,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('upserts the file using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.upsertFile
        .calledWith(
          this.project_id,
          this.folder_id,
          this.fileName,
          this.fsPath,
          this.linkedFileData,
          this.user_id
        )
        .should.equal(true)
    })

    it('returns the file', function() {
      return this.callback.calledWith(null, this.newFile).should.equal(true)
    })

    describe('file does not exist', function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.upsertFile = sinon
          .stub()
          .yields(null, this.file, true)
        return this.EditorController.upsertFile(
          this.project_id,
          this.folder_id,
          this.fileName,
          this.fsPath,
          this.linkedFileData,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should send the update out to users in the project', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFile',
            this.folder_id,
            this.file,
            this.source,
            this.linkedFileData
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertDocWithPath', function() {
    beforeEach(function() {
      this.docPath = '/folder/doc'

      this.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
        .stub()
        .yields(null, this.doc, false, [], this.folder)
      return this.EditorController.upsertDocWithPath(
        this.project_id,
        this.docPath,
        this.docLines,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('upserts the doc using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.upsertDocWithPath
        .calledWith(this.project_id, this.docPath, this.docLines, this.source)
        .should.equal(true)
    })

    describe('doc does not exist', function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
          .stub()
          .yields(null, this.doc, true, [], this.folder)
        return this.EditorController.upsertDocWithPath(
          this.project_id,
          this.docPath,
          this.docLines,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should send the update for the doc out to users in the project', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewDoc',
            this.folder_id,
            this.doc,
            this.source
          )
          .should.equal(true)
      })
    })

    describe('folders required for doc do not exist', function() {
      beforeEach(function() {
        const folders = [
          (this.folderA = { _id: 2, parentFolder_id: 1 }),
          (this.folderB = { _id: 3, parentFolder_id: 2 })
        ]
        this.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
          .stub()
          .yields(null, this.doc, true, folders, this.folderB)
        return this.EditorController.upsertDocWithPath(
          this.project_id,
          this.docPath,
          this.docLines,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should send the update for each folder to users in the project', function() {
        this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFolder',
            this.folderA.parentFolder_id,
            this.folderA
          )
          .should.equal(true)
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFolder',
            this.folderB.parentFolder_id,
            this.folderB
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertFileWithPath', function() {
    beforeEach(function() {
      this.filePath = '/folder/file'

      this.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
        .stub()
        .yields(null, this.newFile, false, this.file, [], this.folder)
      return this.EditorController.upsertFileWithPath(
        this.project_id,
        this.filePath,
        this.fsPath,
        this.linkedFileData,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('upserts the file using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.upsertFileWithPath
        .calledWith(
          this.project_id,
          this.filePath,
          this.fsPath,
          this.linkedFileData
        )
        .should.equal(true)
    })

    describe('file does not exist', function() {
      beforeEach(function() {
        this.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
          .stub()
          .yields(null, this.file, true, undefined, [], this.folder)
        return this.EditorController.upsertFileWithPath(
          this.project_id,
          this.filePath,
          this.fsPath,
          this.linkedFileData,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should send the update for the file out to users in the project', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFile',
            this.folder_id,
            this.file,
            this.source,
            this.linkedFileData
          )
          .should.equal(true)
      })
    })

    describe('folders required for file do not exist', function() {
      beforeEach(function() {
        const folders = [
          (this.folderA = { _id: 2, parentFolder_id: 1 }),
          (this.folderB = { _id: 3, parentFolder_id: 2 })
        ]
        this.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
          .stub()
          .yields(null, this.file, true, undefined, folders, this.folderB)
        return this.EditorController.upsertFileWithPath(
          this.project_id,
          this.filePath,
          this.fsPath,
          this.linkedFileData,
          this.source,
          this.user_id,
          this.callback
        )
      })

      it('should send the update for each folder to users in the project', function() {
        this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFolder',
            this.folderA.parentFolder_id,
            this.folderA
          )
          .should.equal(true)
        return this.EditorRealTimeController.emitToRoom
          .calledWith(
            this.project_id,
            'reciveNewFolder',
            this.folderB.parentFolder_id,
            this.folderB
          )
          .should.equal(true)
      })
    })
  })

  describe('addFolder', function() {
    beforeEach(function() {
      this.EditorController._notifyProjectUsersOfNewFolder = sinon
        .stub()
        .yields()
      this.ProjectEntityUpdateHandler.addFolder = sinon
        .stub()
        .yields(null, this.folder, this.folder_id)
      return this.EditorController.addFolder(
        this.project_id,
        this.folder_id,
        this.folderName,
        this.source,
        this.callback
      )
    })

    it('should add the folder using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.addFolder
        .calledWith(this.project_id, this.folder_id, this.folderName)
        .should.equal(true)
    })

    it('should notifyProjectUsersOfNewFolder', function() {
      return this.EditorController._notifyProjectUsersOfNewFolder.calledWith(
        this.project_id,
        this.folder_id,
        this.folder
      )
    })

    it('should return the folder in the callback', function() {
      return this.callback.calledWith(null, this.folder).should.equal(true)
    })
  })

  describe('mkdirp', function() {
    beforeEach(function() {
      this.path = 'folder1/folder2'
      this.folders = [
        (this.folderA = { _id: 2, parentFolder_id: 1 }),
        (this.folderB = { _id: 3, parentFolder_id: 2 })
      ]
      this.EditorController._notifyProjectUsersOfNewFolders = sinon
        .stub()
        .yields()
      this.ProjectEntityUpdateHandler.mkdirp = sinon
        .stub()
        .yields(null, this.folders, this.folder)
      return this.EditorController.mkdirp(
        this.project_id,
        this.path,
        this.callback
      )
    })

    it('should create the folder using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.mkdirp
        .calledWith(this.project_id, this.path)
        .should.equal(true)
    })

    it('should notifyProjectUsersOfNewFolder', function() {
      return this.EditorController._notifyProjectUsersOfNewFolders.calledWith(
        this.project_id,
        this.folders
      )
    })

    it('should return the folder in the callback', function() {
      return this.callback
        .calledWith(null, this.folders, this.folder)
        .should.equal(true)
    })
  })

  describe('deleteEntity', function() {
    beforeEach(function() {
      this.entity_id = 'entity_id_here'
      this.type = 'doc'
      this.ProjectEntityUpdateHandler.deleteEntity = sinon.stub().yields()
      return this.EditorController.deleteEntity(
        this.project_id,
        this.entity_id,
        this.type,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('should delete the folder using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.deleteEntity.calledWith(
        this.project_id,
        this.entity_id,
        this.type,
        this.user_id
      ).should.equal.true
    })

    it('notify users an entity has been deleted', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'removeEntity',
          this.entity_id,
          this.source
        )
        .should.equal(true)
    })
  })

  describe('deleteEntityWithPath', function() {
    beforeEach(function() {
      this.entity_id = 'entity_id_here'
      this.ProjectEntityUpdateHandler.deleteEntityWithPath = sinon
        .stub()
        .yields(null, this.entity_id)
      this.path = 'folder1/folder2'
      return this.EditorController.deleteEntityWithPath(
        this.project_id,
        this.path,
        this.source,
        this.user_id,
        this.callback
      )
    })

    it('should delete the folder using the project entity handler', function() {
      return this.ProjectEntityUpdateHandler.deleteEntityWithPath.calledWith(
        this.project_id,
        this.path,
        this.user_id
      ).should.equal.true
    })

    it('notify users an entity has been deleted', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'removeEntity',
          this.entity_id,
          this.source
        )
        .should.equal(true)
    })
  })

  describe('notifyUsersProjectHasBeenDeletedOrRenamed', function() {
    it('should emmit a message to all users in a project', function(done) {
      return this.EditorController.notifyUsersProjectHasBeenDeletedOrRenamed(
        this.project_id,
        err => {
          this.EditorRealTimeController.emitToRoom
            .calledWith(
              this.project_id,
              'projectRenamedOrDeletedByExternalSource'
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('updateProjectDescription', function() {
    beforeEach(function() {
      this.description = 'new description'
      return this.EditorController.updateProjectDescription(
        this.project_id,
        this.description,
        this.callback
      )
    })

    it('should send the new description to the project details handler', function() {
      return this.ProjectDetailsHandler.setProjectDescription
        .calledWith(this.project_id, this.description)
        .should.equal(true)
    })

    it('should notify the other clients about the updated description', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'projectDescriptionUpdated',
          this.description
        )
        .should.equal(true)
    })
  })

  describe('deleteProject', function() {
    beforeEach(function() {
      this.err = 'errro'
      return (this.ProjectDeleter.deleteProject = sinon
        .stub()
        .callsArgWith(1, this.err))
    })

    it('should call the project handler', function(done) {
      return this.EditorController.deleteProject(this.project_id, err => {
        err.should.equal(this.err)
        this.ProjectDeleter.deleteProject
          .calledWith(this.project_id)
          .should.equal(true)
        return done()
      })
    })
  })

  describe('renameEntity', function() {
    beforeEach(function(done) {
      this.entity_id = 'entity_id_here'
      this.entityType = 'doc'
      this.newName = 'bobsfile.tex'
      this.ProjectEntityUpdateHandler.renameEntity = sinon.stub().yields()

      return this.EditorController.renameEntity(
        this.project_id,
        this.entity_id,
        this.entityType,
        this.newName,
        this.user_id,
        done
      )
    })

    it('should call the project handler', function() {
      return this.ProjectEntityUpdateHandler.renameEntity
        .calledWith(
          this.project_id,
          this.entity_id,
          this.entityType,
          this.newName,
          this.user_id
        )
        .should.equal(true)
    })

    it('should emit the update to the room', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'reciveEntityRename',
          this.entity_id,
          this.newName
        )
        .should.equal(true)
    })
  })

  describe('moveEntity', function() {
    beforeEach(function() {
      this.entity_id = 'entity_id_here'
      this.entityType = 'doc'
      this.ProjectEntityUpdateHandler.moveEntity = sinon.stub().yields()
      return this.EditorController.moveEntity(
        this.project_id,
        this.entity_id,
        this.folder_id,
        this.entityType,
        this.user_id,
        this.callback
      )
    })

    it('should call the ProjectEntityUpdateHandler', function() {
      return this.ProjectEntityUpdateHandler.moveEntity
        .calledWith(
          this.project_id,
          this.entity_id,
          this.folder_id,
          this.entityType,
          this.user_id
        )
        .should.equal(true)
    })

    it('should emit the update to the room', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'reciveEntityMove',
          this.entity_id,
          this.folder_id
        )
        .should.equal(true)
    })

    it('calls the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })

  describe('renameProject', function() {
    beforeEach(function() {
      this.err = 'errro'
      this.newName = 'new name here'
      return this.EditorController.renameProject(
        this.project_id,
        this.newName,
        this.callback
      )
    })

    it('should call the EditorController', function() {
      return this.ProjectDetailsHandler.renameProject
        .calledWith(this.project_id, this.newName)
        .should.equal(true)
    })

    it('should emit the update to the room', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'projectNameUpdated', this.newName)
        .should.equal(true)
    })
  })

  describe('setCompiler', function() {
    beforeEach(function() {
      this.compiler = 'latex'
      return this.EditorController.setCompiler(
        this.project_id,
        this.compiler,
        this.callback
      )
    })

    it('should send the new compiler and project id to the project options handler', function() {
      this.ProjectOptionsHandler.setCompiler
        .calledWith(this.project_id, this.compiler)
        .should.equal(true)
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'compilerUpdated', this.compiler)
        .should.equal(true)
    })
  })

  describe('setImageName', function() {
    beforeEach(function() {
      this.imageName = 'texlive-1234.5'
      return this.EditorController.setImageName(
        this.project_id,
        this.imageName,
        this.callback
      )
    })

    it('should send the new imageName and project id to the project options handler', function() {
      this.ProjectOptionsHandler.setImageName
        .calledWith(this.project_id, this.imageName)
        .should.equal(true)
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'imageNameUpdated', this.imageName)
        .should.equal(true)
    })
  })

  describe('setSpellCheckLanguage', function() {
    beforeEach(function() {
      this.languageCode = 'fr'
      return this.EditorController.setSpellCheckLanguage(
        this.project_id,
        this.languageCode,
        this.callback
      )
    })

    it('should send the new languageCode and project id to the project options handler', function() {
      this.ProjectOptionsHandler.setSpellCheckLanguage
        .calledWith(this.project_id, this.languageCode)
        .should.equal(true)
      return this.EditorRealTimeController.emitToRoom
        .calledWith(
          this.project_id,
          'spellCheckLanguageUpdated',
          this.languageCode
        )
        .should.equal(true)
    })
  })

  describe('setPublicAccessLevel', function() {
    describe('when setting to private', function() {
      beforeEach(function() {
        this.newAccessLevel = 'private'
        this.ProjectDetailsHandler.ensureTokensArePresent = sinon
          .stub()
          .yields(null, this.tokens)
        return this.EditorController.setPublicAccessLevel(
          this.project_id,
          this.newAccessLevel,
          this.callback
        )
      })

      it('should set the access level', function() {
        return this.ProjectDetailsHandler.setPublicAccessLevel
          .calledWith(this.project_id, this.newAccessLevel)
          .should.equal(true)
      })

      it('should broadcast the access level change', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:publicAccessLevel:changed')
          .should.equal(true)
      })

      it('should not ensure tokens are present for project', function() {
        return this.ProjectDetailsHandler.ensureTokensArePresent
          .calledWith(this.project_id)
          .should.equal(false)
      })

      it('should not broadcast a token change', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:tokens:changed', {
            tokens: this.tokens
          })
          .should.equal(false)
      })
    })

    describe('when setting to tokenBased', function() {
      beforeEach(function() {
        this.newAccessLevel = 'tokenBased'
        this.tokens = { readOnly: 'aaa', readAndWrite: '42bbb' }
        this.ProjectDetailsHandler.ensureTokensArePresent = sinon
          .stub()
          .yields(null, this.tokens)
        return this.EditorController.setPublicAccessLevel(
          this.project_id,
          this.newAccessLevel,
          this.callback
        )
      })

      it('should set the access level', function() {
        return this.ProjectDetailsHandler.setPublicAccessLevel
          .calledWith(this.project_id, this.newAccessLevel)
          .should.equal(true)
      })

      it('should broadcast the access level change', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:publicAccessLevel:changed')
          .should.equal(true)
      })

      it('should ensure tokens are present for project', function() {
        return this.ProjectDetailsHandler.ensureTokensArePresent
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should broadcast the token change too', function() {
        return this.EditorRealTimeController.emitToRoom
          .calledWith(this.project_id, 'project:tokens:changed', {
            tokens: this.tokens
          })
          .should.equal(true)
      })
    })
  })

  describe('setRootDoc', function() {
    beforeEach(function() {
      this.newRootDocID = '21312321321'
      this.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
      return this.EditorController.setRootDoc(
        this.project_id,
        this.newRootDocID,
        this.callback
      )
    })

    it('should call the ProjectEntityUpdateHandler', function() {
      return this.ProjectEntityUpdateHandler.setRootDoc
        .calledWith(this.project_id, this.newRootDocID)
        .should.equal(true)
    })

    it('should emit the update to the room', function() {
      return this.EditorRealTimeController.emitToRoom
        .calledWith(this.project_id, 'rootDocUpdated', this.newRootDocID)
        .should.equal(true)
    })
  })
})
