import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import OError from '@overleaf/o-error'
import mongodb from 'mongodb-legacy'

const modulePath = '../../../../app/src/Features/Editor/EditorController'

const { ObjectId } = mongodb

describe('EditorController', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'test-project-id'
    ctx.source = 'dropbox'
    ctx.user_id = new ObjectId()

    ctx.doc = { _id: (ctx.doc_id = 'test-doc-id') }
    ctx.docName = 'doc.tex'
    ctx.docLines = ['1234', 'dskl']
    ctx.file = { _id: (ctx.file_id = 'dasdkjk') }
    ctx.fileName = 'file.png'
    ctx.fsPath = '/folder/file.png'
    ctx.linkedFileData = { provider: 'url' }

    ctx.newFile = { _id: 'new-file-id' }

    ctx.folder_id = '123ksajdn'
    ctx.folder = { _id: ctx.folder_id }
    ctx.folderName = 'folder'

    ctx.callback = sinon.stub()

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler',
      () => ({
        default: (ctx.ProjectEntityUpdateHandler = {}),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectOptionsHandler',
      () => ({
        default: (ctx.ProjectOptionsHandler = {
          setCompiler: sinon.stub().yields(),
          setImageName: sinon.stub().yields(),
          setSpellCheckLanguage: sinon.stub().yields(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectDetailsHandler',
      () => ({
        default: (ctx.ProjectDetailsHandler = {
          setProjectDescription: sinon.stub().yields(),
          renameProject: sinon.stub().yields(),
          setPublicAccessLevel: sinon.stub().yields(),
        }),
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: (ctx.ProjectDeleter = {
        deleteProject: sinon.stub(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: (ctx.DocumentUpdaterHandler = {
          flushDocToMongo: sinon.stub().yields(),
          setDocument: sinon.stub().yields(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: (ctx.EditorRealTimeController = {
          emitToRoom: sinon.stub(),
        }),
      })
    )

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.Metrics = { inc: sinon.stub() }),
    }))

    ctx.EditorController = (await import(modulePath)).default
  })

  describe('addDoc', function () {
    beforeEach(function (ctx) {
      ctx.ProjectEntityUpdateHandler.addDocWithRanges = sinon
        .stub()
        .yields(null, ctx.doc, ctx.folder_id)
      return ctx.EditorController.addDoc(
        ctx.project_id,
        ctx.folder_id,
        ctx.docName,
        ctx.docLines,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should add the doc using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.addDocWithRanges
        .calledWith(
          ctx.project_id,
          ctx.folder_id,
          ctx.docName,
          ctx.docLines,
          {},
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('should send the update out to the users in the project', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'reciveNewDoc',
          ctx.folder_id,
          ctx.doc,
          ctx.source,
          ctx.user_id
        )
        .should.equal(true)
    })

    it('calls the callback', function (ctx) {
      return ctx.callback.calledWith(null, ctx.doc).should.equal(true)
    })
  })

  describe('addFile', function () {
    beforeEach(function (ctx) {
      ctx.ProjectEntityUpdateHandler.addFile = sinon
        .stub()
        .yields(null, ctx.file, ctx.folder_id)
      return ctx.EditorController.addFile(
        ctx.project_id,
        ctx.folder_id,
        ctx.fileName,
        ctx.fsPath,
        ctx.linkedFileData,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should add the folder using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.addFile
        .calledWith(
          ctx.project_id,
          ctx.folder_id,
          ctx.fileName,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('should send the update of a new folder out to the users in the project', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'reciveNewFile',
          ctx.folder_id,
          ctx.file,
          ctx.source,
          ctx.linkedFileData,
          ctx.user_id
        )
        .should.equal(true)
    })

    it('calls the callback', function (ctx) {
      return ctx.callback.calledWith(null, ctx.file).should.equal(true)
    })
  })

  describe('upsertDoc', function () {
    beforeEach(function (ctx) {
      ctx.ProjectEntityUpdateHandler.upsertDoc = sinon
        .stub()
        .yields(null, ctx.doc, false)
      return ctx.EditorController.upsertDoc(
        ctx.project_id,
        ctx.folder_id,
        ctx.docName,
        ctx.docLines,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('upserts the doc using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.upsertDoc
        .calledWith(
          ctx.project_id,
          ctx.folder_id,
          ctx.docName,
          ctx.docLines,
          ctx.source
        )
        .should.equal(true)
    })

    it('returns the doc', function (ctx) {
      return ctx.callback.calledWith(null, ctx.doc).should.equal(true)
    })

    describe('doc does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectEntityUpdateHandler.upsertDoc = sinon
          .stub()
          .yields(null, ctx.doc, true)
        return ctx.EditorController.upsertDoc(
          ctx.project_id,
          ctx.folder_id,
          ctx.docName,
          ctx.docLines,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('sends an update out to users in the project', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewDoc',
            ctx.folder_id,
            ctx.doc,
            ctx.source,
            ctx.user_id
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertFile', function () {
    beforeEach(function (ctx) {
      ctx.ProjectEntityUpdateHandler.upsertFile = sinon
        .stub()
        .yields(null, ctx.newFile, false, ctx.file)
      return ctx.EditorController.upsertFile(
        ctx.project_id,
        ctx.folder_id,
        ctx.fileName,
        ctx.fsPath,
        ctx.linkedFileData,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('upserts the file using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.upsertFile
        .calledWith(
          ctx.project_id,
          ctx.folder_id,
          ctx.fileName,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('returns the file', function (ctx) {
      return ctx.callback.calledWith(null, ctx.newFile).should.equal(true)
    })

    describe('file does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectEntityUpdateHandler.upsertFile = sinon
          .stub()
          .yields(null, ctx.file, true)
        return ctx.EditorController.upsertFile(
          ctx.project_id,
          ctx.folder_id,
          ctx.fileName,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('should send the update out to users in the project', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFile',
            ctx.folder_id,
            ctx.file,
            ctx.source,
            ctx.linkedFileData,
            ctx.user_id
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertDocWithPath', function () {
    beforeEach(function (ctx) {
      ctx.docPath = '/folder/doc'

      ctx.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
        .stub()
        .yields(null, ctx.doc, false, [], ctx.folder)
      return ctx.EditorController.upsertDocWithPath(
        ctx.project_id,
        ctx.docPath,
        ctx.docLines,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('upserts the doc using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.upsertDocWithPath
        .calledWith(ctx.project_id, ctx.docPath, ctx.docLines, ctx.source)
        .should.equal(true)
    })

    describe('doc does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
          .stub()
          .yields(null, ctx.doc, true, [], ctx.folder)
        return ctx.EditorController.upsertDocWithPath(
          ctx.project_id,
          ctx.docPath,
          ctx.docLines,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('should send the update for the doc out to users in the project', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewDoc',
            ctx.folder_id,
            ctx.doc,
            ctx.source,
            ctx.user_id
          )
          .should.equal(true)
      })
    })

    describe('folders required for doc do not exist', function () {
      beforeEach(function (ctx) {
        const folders = [
          (ctx.folderA = { _id: 2, parentFolder_id: 1 }),
          (ctx.folderB = { _id: 3, parentFolder_id: 2 }),
        ]
        ctx.ProjectEntityUpdateHandler.upsertDocWithPath = sinon
          .stub()
          .yields(null, ctx.doc, true, folders, ctx.folderB)
        return ctx.EditorController.upsertDocWithPath(
          ctx.project_id,
          ctx.docPath,
          ctx.docLines,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('should send the update for each folder to users in the project', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFolder',
            ctx.folderA.parentFolder_id,
            ctx.folderA
          )
          .should.equal(true)
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFolder',
            ctx.folderB.parentFolder_id,
            ctx.folderB
          )
          .should.equal(true)
      })
    })
  })

  describe('upsertFileWithPath', function () {
    beforeEach(function (ctx) {
      ctx.filePath = '/folder/file'

      ctx.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
        .stub()
        .yields(null, ctx.newFile, false, ctx.file, [], ctx.folder)
      return ctx.EditorController.upsertFileWithPath(
        ctx.project_id,
        ctx.filePath,
        ctx.fsPath,
        ctx.linkedFileData,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('upserts the file using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.upsertFileWithPath
        .calledWith(
          ctx.project_id,
          ctx.filePath,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    describe('file does not exist', function () {
      beforeEach(function (ctx) {
        ctx.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
          .stub()
          .yields(null, ctx.file, true, undefined, [], ctx.folder)
        return ctx.EditorController.upsertFileWithPath(
          ctx.project_id,
          ctx.filePath,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('should send the update for the file out to users in the project', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFile',
            ctx.folder_id,
            ctx.file,
            ctx.source,
            ctx.linkedFileData,
            ctx.user_id
          )
          .should.equal(true)
      })
    })

    describe('folders required for file do not exist', function () {
      beforeEach(function (ctx) {
        const folders = [
          (ctx.folderA = { _id: 2, parentFolder_id: 1 }),
          (ctx.folderB = { _id: 3, parentFolder_id: 2 }),
        ]
        ctx.ProjectEntityUpdateHandler.upsertFileWithPath = sinon
          .stub()
          .yields(null, ctx.file, true, undefined, folders, ctx.folderB)
        return ctx.EditorController.upsertFileWithPath(
          ctx.project_id,
          ctx.filePath,
          ctx.fsPath,
          ctx.linkedFileData,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('should send the update for each folder to users in the project', function (ctx) {
        ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFolder',
            ctx.folderA.parentFolder_id,
            ctx.folderA
          )
          .should.equal(true)
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(
            ctx.project_id,
            'reciveNewFolder',
            ctx.folderB.parentFolder_id,
            ctx.folderB
          )
          .should.equal(true)
      })
    })
  })

  describe('addFolder', function () {
    beforeEach(function (ctx) {
      ctx.EditorController._notifyProjectUsersOfNewFolder = sinon
        .stub()
        .yields()
      ctx.ProjectEntityUpdateHandler.addFolder = sinon
        .stub()
        .yields(null, ctx.folder, ctx.folder_id)
      return ctx.EditorController.addFolder(
        ctx.project_id,
        ctx.folder_id,
        ctx.folderName,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should add the folder using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.addFolder
        .calledWith(ctx.project_id, ctx.folder_id, ctx.folderName, ctx.user_id)
        .should.equal(true)
    })

    it('should notifyProjectUsersOfNewFolder', function (ctx) {
      return ctx.EditorController._notifyProjectUsersOfNewFolder
        .calledWith(ctx.project_id, ctx.folder_id, ctx.folder, ctx.user_id)
        .should.equal(true)
    })

    it('should return the folder in the callback', function (ctx) {
      return ctx.callback.calledWith(null, ctx.folder).should.equal(true)
    })
  })

  describe('mkdirp', function () {
    beforeEach(function (ctx) {
      ctx.path = 'folder1/folder2'
      ctx.folders = [
        (ctx.folderA = { _id: 2, parentFolder_id: 1 }),
        (ctx.folderB = { _id: 3, parentFolder_id: 2 }),
      ]
      ctx.userId = new ObjectId().toString()
      ctx.EditorController._notifyProjectUsersOfNewFolders = sinon
        .stub()
        .yields()
      ctx.ProjectEntityUpdateHandler.mkdirp = sinon
        .stub()
        .yields(null, ctx.folders, ctx.folder)
      return ctx.EditorController.mkdirp(
        ctx.project_id,
        ctx.path,
        ctx.userId,
        ctx.callback
      )
    })

    it('should create the folder using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.mkdirp
        .calledWith(ctx.project_id, ctx.path, ctx.userId)
        .should.equal(true)
    })

    it('should notifyProjectUsersOfNewFolder', function (ctx) {
      return ctx.EditorController._notifyProjectUsersOfNewFolders.calledWith(
        ctx.project_id,
        ctx.folders
      )
    })

    it('should return the folder in the callback', function (ctx) {
      return ctx.callback
        .calledWith(null, ctx.folders, ctx.folder)
        .should.equal(true)
    })
  })

  describe('deleteEntity', function () {
    beforeEach(function (ctx) {
      ctx.entity_id = 'entity_id_here'
      ctx.type = 'doc'
      ctx.ProjectEntityUpdateHandler.deleteEntity = sinon.stub().yields()
      return ctx.EditorController.deleteEntity(
        ctx.project_id,
        ctx.entity_id,
        ctx.type,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should delete the folder using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.deleteEntity
        .calledWith(
          ctx.project_id,
          ctx.entity_id,
          ctx.type,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('notify users an entity has been deleted', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'removeEntity', ctx.entity_id, ctx.source)
        .should.equal(true)
    })
  })

  describe('deleteEntityWithPath', function () {
    beforeEach(function (ctx) {
      ctx.entity_id = 'entity_id_here'
      ctx.ProjectEntityUpdateHandler.deleteEntityWithPath = sinon
        .stub()
        .yields(null, ctx.entity_id)
      ctx.path = 'folder1/folder2'
      return ctx.EditorController.deleteEntityWithPath(
        ctx.project_id,
        ctx.path,
        ctx.source,
        ctx.user_id,
        ctx.callback
      )
    })

    it('should delete the folder using the project entity handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.deleteEntityWithPath
        .calledWith(ctx.project_id, ctx.path, ctx.user_id, ctx.source)
        .should.equal(true)
    })

    it('notify users an entity has been deleted', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'removeEntity', ctx.entity_id, ctx.source)
        .should.equal(true)
    })
  })

  describe('updateProjectDescription', function () {
    beforeEach(function (ctx) {
      ctx.description = 'new description'
      return ctx.EditorController.updateProjectDescription(
        ctx.project_id,
        ctx.description,
        ctx.callback
      )
    })

    it('should send the new description to the project details handler', function (ctx) {
      return ctx.ProjectDetailsHandler.setProjectDescription
        .calledWith(ctx.project_id, ctx.description)
        .should.equal(true)
    })

    it('should notify the other clients about the updated description', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'projectDescriptionUpdated',
          ctx.description
        )
        .should.equal(true)
    })
  })

  describe('deleteProject', function () {
    beforeEach(function (ctx) {
      ctx.err = 'errro'
      ctx.ProjectDeleter.deleteProject.callsArgWith(1, ctx.err)
    })

    it('should call the project handler', async function (ctx) {
      await new Promise(resolve => {
        ctx.EditorController.deleteProject(ctx.project_id, err => {
          err.should.equal(ctx.err)
          ctx.ProjectDeleter.deleteProject
            .calledWith(ctx.project_id)
            .should.equal(true)
          resolve()
        })
      })
    })
  })

  describe('renameEntity', function () {
    beforeEach(async function (ctx) {
      await new Promise(resolve => {
        ctx.entity_id = 'entity_id_here'
        ctx.entityType = 'doc'
        ctx.newName = 'bobsfile.tex'
        ctx.ProjectEntityUpdateHandler.renameEntity = sinon.stub().yields()

        return ctx.EditorController.renameEntity(
          ctx.project_id,
          ctx.entity_id,
          ctx.entityType,
          ctx.newName,
          ctx.user_id,
          ctx.source,
          resolve
        )
      })
    })

    it('should call the project handler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.renameEntity
        .calledWith(
          ctx.project_id,
          ctx.entity_id,
          ctx.entityType,
          ctx.newName,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('should emit the update to the room', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'reciveEntityRename',
          ctx.entity_id,
          ctx.newName
        )
        .should.equal(true)
    })
  })

  describe('moveEntity', function () {
    beforeEach(function (ctx) {
      ctx.entity_id = 'entity_id_here'
      ctx.entityType = 'doc'
      ctx.ProjectEntityUpdateHandler.moveEntity = sinon.stub().yields()
      return ctx.EditorController.moveEntity(
        ctx.project_id,
        ctx.entity_id,
        ctx.folder_id,
        ctx.entityType,
        ctx.user_id,
        ctx.source,
        ctx.callback
      )
    })

    it('should call the ProjectEntityUpdateHandler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.moveEntity
        .calledWith(
          ctx.project_id,
          ctx.entity_id,
          ctx.folder_id,
          ctx.entityType,
          ctx.user_id,
          ctx.source
        )
        .should.equal(true)
    })

    it('should emit the update to the room', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'reciveEntityMove',
          ctx.entity_id,
          ctx.folder_id
        )
        .should.equal(true)
    })

    it('calls the callback', function (ctx) {
      return ctx.callback.called.should.equal(true)
    })
  })

  describe('renameProject', function () {
    beforeEach(function (ctx) {
      ctx.err = 'errro'
      ctx.newName = 'new name here'
      return ctx.EditorController.renameProject(
        ctx.project_id,
        ctx.newName,
        ctx.callback
      )
    })

    it('should call the EditorController', function (ctx) {
      return ctx.ProjectDetailsHandler.renameProject
        .calledWith(ctx.project_id, ctx.newName)
        .should.equal(true)
    })

    it('should emit the update to the room', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'projectNameUpdated', ctx.newName)
        .should.equal(true)
    })
  })

  describe('setCompiler', function () {
    beforeEach(function (ctx) {
      ctx.compiler = 'latex'
      return ctx.EditorController.setCompiler(
        ctx.project_id,
        ctx.compiler,
        ctx.callback
      )
    })

    it('should send the new compiler and project id to the project options handler', function (ctx) {
      ctx.ProjectOptionsHandler.setCompiler
        .calledWith(ctx.project_id, ctx.compiler)
        .should.equal(true)
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'compilerUpdated', ctx.compiler)
        .should.equal(true)
    })
  })

  describe('setImageName', function () {
    beforeEach(function (ctx) {
      ctx.imageName = 'texlive-1234.5'
      return ctx.EditorController.setImageName(
        ctx.project_id,
        ctx.imageName,
        ctx.callback
      )
    })

    it('should send the new imageName and project id to the project options handler', function (ctx) {
      ctx.ProjectOptionsHandler.setImageName
        .calledWith(ctx.project_id, ctx.imageName)
        .should.equal(true)
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'imageNameUpdated', ctx.imageName)
        .should.equal(true)
    })
  })

  describe('setSpellCheckLanguage', function () {
    beforeEach(function (ctx) {
      ctx.languageCode = 'fr'
      return ctx.EditorController.setSpellCheckLanguage(
        ctx.project_id,
        ctx.languageCode,
        ctx.callback
      )
    })

    it('should send the new languageCode and project id to the project options handler', function (ctx) {
      ctx.ProjectOptionsHandler.setSpellCheckLanguage
        .calledWith(ctx.project_id, ctx.languageCode)
        .should.equal(true)
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(
          ctx.project_id,
          'spellCheckLanguageUpdated',
          ctx.languageCode
        )
        .should.equal(true)
    })
  })

  describe('setPublicAccessLevel', function () {
    describe('when setting to private', function () {
      beforeEach(function (ctx) {
        ctx.newAccessLevel = 'private'
        ctx.ProjectDetailsHandler.ensureTokensArePresent = sinon.stub().yields()
        return ctx.EditorController.setPublicAccessLevel(
          ctx.project_id,
          ctx.newAccessLevel,
          ctx.callback
        )
      })

      it('should set the access level', function (ctx) {
        return ctx.ProjectDetailsHandler.setPublicAccessLevel
          .calledWith(ctx.project_id, ctx.newAccessLevel)
          .should.equal(true)
      })

      it('should broadcast the access level change', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(ctx.project_id, 'project:publicAccessLevel:changed')
          .should.equal(true)
      })

      it('should not ensure tokens are present for project', function (ctx) {
        return ctx.ProjectDetailsHandler.ensureTokensArePresent
          .calledWith(ctx.project_id)
          .should.equal(false)
      })
    })

    describe('when setting to tokenBased', function () {
      beforeEach(function (ctx) {
        ctx.newAccessLevel = 'tokenBased'
        ctx.tokens = { readOnly: 'aaa', readAndWrite: '42bbb' }
        ctx.ProjectDetailsHandler.ensureTokensArePresent = sinon.stub().yields()
        return ctx.EditorController.setPublicAccessLevel(
          ctx.project_id,
          ctx.newAccessLevel,
          ctx.callback
        )
      })

      it('should set the access level', function (ctx) {
        return ctx.ProjectDetailsHandler.setPublicAccessLevel
          .calledWith(ctx.project_id, ctx.newAccessLevel)
          .should.equal(true)
      })

      it('should broadcast the access level change', function (ctx) {
        return ctx.EditorRealTimeController.emitToRoom
          .calledWith(ctx.project_id, 'project:publicAccessLevel:changed')
          .should.equal(true)
      })

      it('should ensure tokens are present for project', function (ctx) {
        return ctx.ProjectDetailsHandler.ensureTokensArePresent
          .calledWith(ctx.project_id)
          .should.equal(true)
      })
    })
  })

  describe('setRootDoc', function () {
    beforeEach(function (ctx) {
      ctx.newRootDocID = '21312321321'
      ctx.ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
      return ctx.EditorController.setRootDoc(
        ctx.project_id,
        ctx.newRootDocID,
        ctx.callback
      )
    })

    it('should call the ProjectEntityUpdateHandler', function (ctx) {
      return ctx.ProjectEntityUpdateHandler.setRootDoc
        .calledWith(ctx.project_id, ctx.newRootDocID)
        .should.equal(true)
    })

    it('should emit the update to the room', function (ctx) {
      return ctx.EditorRealTimeController.emitToRoom
        .calledWith(ctx.project_id, 'rootDocUpdated', ctx.newRootDocID)
        .should.equal(true)
    })
  })

  describe('setMainBibliographyDoc', function () {
    describe('on success', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.mainBibliographyId = 'bib-doc-id'
          ctx.ProjectEntityUpdateHandler.setMainBibliographyDoc = sinon
            .stub()
            .yields()

          ctx.callback = sinon.stub().callsFake(resolve)
          ctx.EditorController.setMainBibliographyDoc(
            ctx.project_id,
            ctx.mainBibliographyId,
            ctx.callback
          )
        })
      })

      it('should forward the call to the ProjectEntityUpdateHandler', function (ctx) {
        expect(
          ctx.ProjectEntityUpdateHandler.setMainBibliographyDoc
        ).to.have.been.calledWith(ctx.project_id, ctx.mainBibliographyId)
      })

      it('should emit the update to the room', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.have.been.calledWith(
          ctx.project_id,
          'mainBibliographyDocUpdated',
          ctx.mainBibliographyId
        )
      })

      it('should return nothing', function (ctx) {
        expect(ctx.callback).to.have.been.calledWithExactly()
      })
    })

    describe('on error', function () {
      beforeEach(async function (ctx) {
        await new Promise(resolve => {
          ctx.mainBibliographyId = 'bib-doc-id'
          ctx.error = new Error('oh no')
          ctx.ProjectEntityUpdateHandler.setMainBibliographyDoc = sinon
            .stub()
            .yields(ctx.error)

          ctx.callback = sinon.stub().callsFake(() => resolve())
          ctx.EditorController.setMainBibliographyDoc(
            ctx.project_id,
            ctx.mainBibliographyId,
            ctx.callback
          )
        })
      })

      it('should forward the call to the ProjectEntityUpdateHandler', function (ctx) {
        expect(
          ctx.ProjectEntityUpdateHandler.setMainBibliographyDoc
        ).to.have.been.calledWith(ctx.project_id, ctx.mainBibliographyId)
      })

      it('should return the error', function (ctx) {
        expect(ctx.callback).to.have.been.calledWithExactly(ctx.error)
      })

      it('should not emit the update to the room', function (ctx) {
        expect(ctx.EditorRealTimeController.emitToRoom).to.not.have.been.called
      })
    })
  })

  describe('appendToDoc', function () {
    describe('on success', function () {
      beforeEach(function (ctx) {
        ctx.docId = 'doc-1'
        ctx.ProjectEntityUpdateHandler.appendToDoc = sinon
          .stub()
          .yields(null, { rev: '1' })
        ctx.EditorController.appendToDoc(
          ctx.project_id,
          ctx.docId,
          ctx.docLines,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('appends to the doc using the project entity handler', function (ctx) {
        ctx.ProjectEntityUpdateHandler.appendToDoc
          .calledWith(ctx.project_id, ctx.docId, ctx.docLines, ctx.source)
          .should.equal(true)
      })
    })

    describe('on error', function () {
      beforeEach(function (ctx) {
        ctx.docId = 'doc-1'
        ctx.ProjectEntityUpdateHandler.appendToDoc = sinon
          .stub()
          .yields(new Error('foo'))
        ctx.EditorController.appendToDoc(
          ctx.project_id,
          ctx.docId,
          ctx.docLines,
          ctx.source,
          ctx.user_id,
          ctx.callback
        )
      })

      it('tries to append to the doc using the project entity handler', function (ctx) {
        ctx.ProjectEntityUpdateHandler.appendToDoc
          .calledWith(ctx.project_id, ctx.docId, ctx.docLines, ctx.source)
          .should.equal(true)
      })

      it('tags the error', function (ctx) {
        ctx.callback.calledWith(sinon.match.instanceOf(OError))
      })
    })
  })
})
