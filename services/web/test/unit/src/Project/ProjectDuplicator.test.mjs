import { vi, expect } from 'vitest'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

const MODULE_PATH = '../../../../app/src/Features/Project/ProjectDuplicator.mjs'

describe('ProjectDuplicator', function () {
  beforeEach(async function (ctx) {
    ctx.doc0 = { _id: 'doc0_id', name: 'rootDocHere' }
    ctx.doc1 = { _id: 'doc1_id', name: 'level1folderDocName' }
    ctx.doc2 = { _id: 'doc2_id', name: 'level2folderDocName' }
    ctx.doc0Lines = ['zero']
    ctx.doc1Lines = ['one']
    ctx.doc2Lines = ['two']
    ctx.file0 = { name: 'file0', _id: 'file0', hash: 'abcde' }
    ctx.file1 = { name: 'file1', _id: 'file1', hash: 'fffff' }
    ctx.file2 = {
      name: 'file2',
      _id: 'file2',
      created: '2024-07-05T14:18:31.401+00:00',
      linkedFileData: { provider: 'url' },
      hash: '123456',
    }
    ctx.level2folder = {
      name: 'level2folderName',
      _id: 'level2folderId',
      docs: [ctx.doc2, undefined],
      folders: [],
      fileRefs: [ctx.file2],
    }
    ctx.level1folder = {
      name: 'level1folder',
      _id: 'level1folderId',
      docs: [ctx.doc1],
      folders: [ctx.level2folder],
      fileRefs: [ctx.file1, null], // the null is intentional to test null docs/files
    }
    ctx.rootFolder = {
      name: 'rootFolder',
      _id: 'rootFolderId',
      docs: [ctx.doc0],
      folders: [ctx.level1folder, {}],
      fileRefs: [ctx.file0],
    }
    ctx.project = {
      _id: 'this_is_the_old_project_id',
      rootDoc_id: ctx.doc0._id,
      rootFolder: [ctx.rootFolder],
      compiler: 'this_is_a_Compiler',
      overleaf: { history: { id: 123456 } },
    }
    ctx.doc0Path = '/rootDocHere'
    ctx.doc1Path = '/level1folder/level1folderDocName'
    ctx.doc2Path = '/level1folder/level2folderName/level2folderDocName'
    ctx.file0Path = '/file0'
    ctx.file1Path = '/level1folder/file1'
    ctx.file2Path = '/level1folder/level2folderName/file2'

    ctx.docContents = [
      { _id: ctx.doc0._id, lines: ctx.doc0Lines },
      { _id: ctx.doc1._id, lines: ctx.doc1Lines },
      { _id: ctx.doc2._id, lines: ctx.doc2Lines },
    ]

    ctx.rootDoc = ctx.doc0
    ctx.rootDocPath = '/rootDocHere'
    ctx.owner = { _id: 'this_is_the_owner' }
    ctx.newBlankProject = {
      _id: 'new_project_id',
      overleaf: { history: { id: 339123 } },
      readOnly_refs: [],
      collaberator_refs: [],
      rootFolder: [{ _id: 'new_root_folder_id' }],
    }
    ctx.newFolder = { _id: 'newFolderId' }
    ctx.filestoreUrl = 'filestore-url'
    ctx.newProjectVersion = 2

    ctx.newDocId = new ObjectId()
    ctx.newFileId = new ObjectId()
    ctx.newDoc0 = { ...ctx.doc0, _id: ctx.newDocId }
    ctx.newDoc1 = { ...ctx.doc1, _id: ctx.newDocId }
    ctx.newDoc2 = { ...ctx.doc2, _id: ctx.newDocId }
    ctx.newFile0 = { ...ctx.file0, _id: ctx.newFileId }
    ctx.newFile1 = { ...ctx.file1, _id: ctx.newFileId }
    ctx.newFile2 = { ...ctx.file2, _id: ctx.newFileId }

    ctx.docEntries = [
      {
        path: ctx.doc0Path,
        doc: ctx.newDoc0,
        docLines: ctx.doc0Lines.join('\n'),
      },
      {
        path: ctx.doc1Path,
        doc: ctx.newDoc1,
        docLines: ctx.doc1Lines.join('\n'),
      },
      {
        path: ctx.doc2Path,
        doc: ctx.newDoc2,
        docLines: ctx.doc2Lines.join('\n'),
      },
    ]
    ctx.fileEntries = [
      {
        createdBlob: true,
        path: ctx.file0Path,
        file: ctx.newFile0,
      },
      {
        createdBlob: true,
        path: ctx.file1Path,
        file: ctx.newFile1,
      },
      {
        createdBlob: true,
        path: ctx.file2Path,
        file: ctx.newFile2,
      },
    ]

    ctx.Doc = sinon.stub().callsFake(props => ({ _id: ctx.newDocId, ...props }))
    ctx.File = sinon
      .stub()
      .callsFake(props => ({ _id: ctx.newFileId, ...props }))

    ctx.DocstoreManager = {
      promises: {
        updateDoc: sinon.stub().resolves(),
        getAllDocs: sinon.stub().resolves(ctx.docContents),
      },
    }
    ctx.DocumentUpdaterHandler = {
      promises: {
        flushProjectToMongo: sinon.stub().resolves(),
        updateProjectStructure: sinon.stub().resolves(),
      },
    }
    ctx.HistoryManager = {
      promises: {
        copyBlob: sinon.stub().callsFake((historyId, newHistoryId, hash) => {
          if (hash === '500') {
            return Promise.reject(new Error('copy blob error'))
          }
          return Promise.resolve()
        }),
      },
    }
    ctx.TagsHandler = {
      promises: {
        addProjectToTags: sinon.stub().resolves({
          _id: 'project-1',
        }),
        countTagsForProject: sinon.stub().resolves(1),
      },
    }
    ctx.ProjectCreationHandler = {
      promises: {
        createBlankProject: sinon.stub().resolves(ctx.newBlankProject),
      },
    }
    ctx.ProjectDeleter = {
      promises: {
        deleteProject: sinon.stub().resolves(),
      },
    }
    ctx.ProjectEntityMongoUpdateHandler = {
      promises: {
        createNewFolderStructure: sinon.stub().resolves(ctx.newProjectVersion),
      },
    }
    ctx.ProjectEntityUpdateHandler = {
      isPathValidForRootDoc: sinon.stub().returns(true),
      promises: {
        setRootDoc: sinon.stub().resolves(),
      },
    }
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon
          .stub()
          .withArgs(ctx.project._id)
          .resolves(ctx.project),
      },
    }
    ctx.ProjectLocator = {
      promises: {
        findRootDoc: sinon.stub().resolves({
          element: ctx.rootDoc,
          path: { fileSystem: ctx.rootDocPath },
        }),
        findElementByPath: sinon
          .stub()
          .withArgs({
            project_id: ctx.newBlankProject._id,
            path: ctx.rootDocPath,
            exactCaseMatch: true,
          })
          .resolves({ element: ctx.doc0 }),
      },
    }
    ctx.ProjectOptionsHandler = {
      promises: {
        setCompiler: sinon.stub().resolves(),
      },
    }
    ctx.TpdsProjectFlusher = {
      promises: {
        flushProjectToTpds: sinon.stub().resolves(),
      },
    }
    ctx.Modules = {
      promises: {
        hooks: {
          fire: sinon.stub().resolves([]),
        },
      },
    }

    vi.doMock('../../../../app/src/models/Doc', () => ({
      Doc: ctx.Doc,
    }))

    vi.doMock('../../../../app/src/models/File', () => ({
      File: ctx.File,
    }))

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: ctx.DocstoreManager,
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectCreationHandler',
      () => ({
        default: ctx.ProjectCreationHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectDeleter', () => ({
      default: ctx.ProjectDeleter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler',
      () => ({
        default: ctx.ProjectEntityMongoUpdateHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityUpdateHandler',
      () => ({
        default: ctx.ProjectEntityUpdateHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectOptionsHandler',
      () => ({
        default: ctx.ProjectOptionsHandler,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsProjectFlusher',
      () => ({
        default: ctx.TpdsProjectFlusher,
      })
    )

    vi.doMock('../../../../app/src/Features/Tags/TagsHandler', () => ({
      default: ctx.TagsHandler,
    }))

    vi.doMock('../../../../app/src/Features/History/HistoryManager', () => ({
      default: ctx.HistoryManager,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('../../../../app/src/Features/Compile/ClsiCacheManager', () => ({
      default: {
        prepareClsiCache: sinon.stub().rejects(new Error('ignore this')),
      },
    }))

    ctx.ProjectDuplicator = (await import(MODULE_PATH)).default
  })

  describe('when the copy succeeds', function () {
    beforeEach(async function (ctx) {
      ctx.newProjectName = 'New project name'
      ctx.newProject = await ctx.ProjectDuplicator.promises.duplicate(
        ctx.owner,
        ctx.project._id,
        ctx.newProjectName
      )
    })

    it('should flush the original project to mongo', function (ctx) {
      ctx.DocumentUpdaterHandler.promises.flushProjectToMongo.should.have.been.calledWith(
        ctx.project._id
      )
    })

    it('should copy docs to docstore', function (ctx) {
      for (const docLines of [ctx.doc0Lines, ctx.doc1Lines, ctx.doc2Lines]) {
        ctx.DocstoreManager.promises.updateDoc.should.have.been.calledWith(
          ctx.newProject._id.toString(),
          ctx.newDocId.toString(),
          docLines,
          0,
          {}
        )
      }
    })

    it('should duplicate the files with hashes by copying the blobs in history v1', function (ctx) {
      for (const file of [ctx.file0, ctx.file1, ctx.file2]) {
        ctx.HistoryManager.promises.copyBlob.should.have.been.calledWith(
          ctx.project.overleaf.history.id,
          ctx.newProject.overleaf.history.id,
          file.hash
        )
      }
    })

    it('should create a blank project', function (ctx) {
      ctx.ProjectCreationHandler.promises.createBlankProject.should.have.been.calledWith(
        ctx.owner._id,
        ctx.newProjectName
      )
      ctx.newProject._id.should.equal(ctx.newBlankProject._id)
    })

    it('should use the same compiler', function (ctx) {
      ctx.ProjectOptionsHandler.promises.setCompiler.should.have.been.calledWith(
        ctx.newProject._id,
        ctx.project.compiler
      )
    })

    it('should use the same root doc', function (ctx) {
      ctx.ProjectEntityUpdateHandler.promises.setRootDoc.should.have.been.calledWith(
        ctx.newProject._id,
        ctx.rootFolder.docs[0]._id
      )
    })

    it('should not copy the collaborators or read only refs', function (ctx) {
      ctx.newProject.collaberator_refs.length.should.equal(0)
      ctx.newProject.readOnly_refs.length.should.equal(0)
    })

    it('should copy all documents and files', function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.should.have.been.calledWith(
        ctx.newProject._id,
        ctx.docEntries,
        ctx.fileEntries
      )
    })

    it('should notify document updater of changes', function (ctx) {
      ctx.DocumentUpdaterHandler.promises.updateProjectStructure.should.have.been.calledWith(
        ctx.newProject._id,
        ctx.newProject.overleaf.history.id,
        ctx.owner._id,
        {
          newDocs: ctx.docEntries,
          newFiles: ctx.fileEntries,
          newProject: { version: ctx.newProjectVersion },
        },
        null
      )
    })

    it('should flush the project to TPDS', function (ctx) {
      ctx.TpdsProjectFlusher.promises.flushProjectToTpds.should.have.been.calledWith(
        ctx.newProject._id
      )
    })
  })

  describe('without a root doc', function () {
    beforeEach(async function (ctx) {
      ctx.ProjectLocator.promises.findRootDoc.resolves({
        element: null,
        path: null,
      })
      ctx.newProject = await ctx.ProjectDuplicator.promises.duplicate(
        ctx.owner,
        ctx.project._id,
        'Copy of project'
      )
    })

    it('should not set the root doc on the copy', function (ctx) {
      ctx.ProjectEntityUpdateHandler.promises.setRootDoc.should.not.have.been
        .called
    })
  })

  describe('with an invalid root doc', function () {
    beforeEach(async function (ctx) {
      ctx.ProjectEntityUpdateHandler.isPathValidForRootDoc.returns(false)
      ctx.newProject = await ctx.ProjectDuplicator.promises.duplicate(
        ctx.owner,
        ctx.project._id,
        'Copy of project'
      )
    })

    it('should not set the root doc on the copy', function (ctx) {
      ctx.ProjectEntityUpdateHandler.promises.setRootDoc.should.not.have.been
        .called
    })
  })

  describe('when cloning in history-v1 fails', function () {
    it('should fail the clone operation', async function (ctx) {
      ctx.file0.hash = '500'
      await expect(
        ctx.ProjectDuplicator.promises.duplicate(
          ctx.owner,
          ctx.project._id,
          'name'
        )
      ).to.be.rejectedWith('copy blob error')
    })
  })

  describe('when there is an error', function () {
    beforeEach(async function (ctx) {
      ctx.ProjectEntityMongoUpdateHandler.promises.createNewFolderStructure.rejects()
      await expect(
        ctx.ProjectDuplicator.promises.duplicate(ctx.owner, ctx.project._id, '')
      ).to.be.rejected
    })

    it('should delete the broken cloned project', function (ctx) {
      ctx.ProjectDeleter.promises.deleteProject.should.have.been.calledWith(
        ctx.newBlankProject._id
      )
    })

    it('should not delete the original project', function (ctx) {
      ctx.ProjectDeleter.promises.deleteProject.should.not.have.been.calledWith(
        ctx.project._id
      )
    })
  })
})
