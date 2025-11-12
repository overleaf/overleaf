import { vi, expect } from 'vitest'
import sinon from 'sinon'
import tk from 'timekeeper'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import mongodb from 'mongodb-legacy'
import { Project } from '../../../../app/src/models/Project.mjs'

const { ObjectId } = mongodb

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler'

describe('ProjectEntityMongoUpdateHandler', function () {
  beforeEach(async function (ctx) {
    tk.freeze(new Date())
    ctx.doc = {
      _id: new ObjectId(),
      name: 'test-doc.txt',
      lines: ['hello', 'world'],
      rev: 1234,
    }
    ctx.docPath = {
      mongo: 'rootFolder.0.docs.0',
      fileSystem: '/test-doc.txt',
    }
    ctx.file = {
      _id: new ObjectId(),
      name: 'something.jpg',
      linkedFileData: { provider: 'url' },
      hash: 'some-hash',
    }
    ctx.filePath = {
      fileSystem: '/something.png',
      mongo: 'rootFolder.0.fileRefs.0',
    }
    ctx.subfolder = { _id: new ObjectId(), name: 'test-subfolder' }
    ctx.subfolderPath = {
      fileSystem: '/test-folder/test-subfolder',
      mongo: 'rootFolder.0.folders.0.folders.0',
    }
    ctx.notSubfolder = { _id: new ObjectId(), name: 'test-folder-2' }
    ctx.notSubfolderPath = {
      fileSystem: '/test-folder-2/test-subfolder',
      mongo: 'rootFolder.0.folders.0.folders.0',
    }
    ctx.folder = {
      _id: new ObjectId(),
      name: 'test-folder',
      folders: [ctx.subfolder],
    }
    ctx.folderPath = {
      fileSystem: '/test-folder',
      mongo: 'rootFolder.0.folders.0',
    }
    ctx.rootFolder = {
      _id: new ObjectId(),
      folders: [ctx.folder],
      docs: [ctx.doc],
      fileRefs: [ctx.file],
    }
    ctx.rootFolderPath = {
      fileSystem: '/',
      mongo: 'rootFolder.0',
    }
    ctx.project = {
      _id: new ObjectId(),
      name: 'project name',
      rootFolder: [ctx.rootFolder],
    }

    ctx.Settings = { maxEntitiesPerProject: 100 }
    ctx.CooldownManager = {}
    ctx.LockManager = {
      promises: {
        runWithLock: sinon.spy((namespace, id, runner) => runner()),
      },
    }

    ctx.FolderModel = sinon.stub()
    ctx.ProjectMock = sinon.mock(Project)
    ctx.ProjectEntityHandler = {
      getAllEntitiesFromProject: sinon.stub(),
    }
    ctx.ProjectLocator = {
      findElementByMongoPath: sinon.stub().throws(new Error('not found')),
      promises: {
        findElement: sinon.stub().rejects(new Error('not found')),
        findElementByPath: sinon.stub().rejects(new Error('not found')),
      },
    }
    ctx.ProjectLocator.promises.findElement
      .withArgs({
        project: ctx.project,
        element_id: ctx.rootFolder._id,
        type: 'folder',
      })
      .resolves({
        element: ctx.rootFolder,
        path: ctx.rootFolderPath,
      })
    ctx.ProjectLocator.promises.findElement
      .withArgs({
        project: ctx.project,
        element_id: ctx.folder._id,
        type: 'folder',
      })
      .resolves({
        element: ctx.folder,
        path: ctx.folderPath,
        folder: ctx.rootFolder,
      })
    ctx.ProjectLocator.promises.findElement
      .withArgs({
        project: ctx.project,
        element_id: ctx.subfolder._id,
        type: 'folder',
      })
      .resolves({
        element: ctx.subfolder,
        path: ctx.subfolderPath,
        folder: ctx.folder,
      })
    ctx.ProjectLocator.promises.findElement
      .withArgs({
        project: ctx.project,
        element_id: ctx.file._id,
        type: 'file',
      })
      .resolves({
        element: ctx.file,
        path: ctx.filePath,
        folder: ctx.rootFolder,
      })
    ctx.ProjectLocator.promises.findElement
      .withArgs({
        project: ctx.project,
        element_id: ctx.doc._id,
        type: 'doc',
      })
      .resolves({
        element: ctx.doc,
        path: ctx.docPath,
        folder: ctx.rootFolder,
      })
    ctx.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: ctx.project,
          path: '/',
        })
      )
      .resolves({ element: ctx.rootFolder, type: 'folder', folder: null })
    ctx.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: ctx.project,
          path: '/test-folder',
        })
      )
      .resolves({
        element: ctx.folder,
        type: 'folder',
        folder: ctx.rootFolder,
      })
    ctx.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: ctx.project,
          path: '/test-folder/test-subfolder',
        })
      )
      .resolves({
        element: ctx.subfolder,
        type: 'folder',
        folder: ctx.folder,
      })

    ctx.ProjectGetter = {
      promises: {
        getProjectWithoutLock: sinon
          .stub()
          .withArgs(ctx.project._id)
          .resolves(ctx.project),
        getProjectWithOnlyFolders: sinon.stub().resolves(ctx.project),
      },
    }

    ctx.FolderStructureBuilder = {
      buildFolderStructure: sinon.stub(),
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/Features/Cooldown/CooldownManager', () => ({
      default: ctx.CooldownManager,
    }))

    vi.doMock('../../../../app/src/models/Folder', () => ({
      Folder: ctx.FolderModel,
    }))

    vi.doMock('../../../../app/src/infrastructure/LockManager', () => ({
      default: ctx.LockManager,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEntityHandler',
      () => ({
        default: ctx.ProjectEntityHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/FolderStructureBuilder',
      () => ({
        default: ctx.FolderStructureBuilder,
      })
    )

    ctx.subject = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.ProjectMock.restore()
    tk.reset()
  })

  describe('addDoc', function () {
    beforeEach(async function (ctx) {
      const doc = { _id: new ObjectId(), name: 'other.txt' }
      const userId = new ObjectId().toString()
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: ctx.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: { 'rootFolder.0.folders.0.docs': doc },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          }
        )
        .chain('exec')
        .resolves(ctx.project)
      ctx.result = await ctx.subject.promises.addDoc(
        ctx.project._id,
        ctx.folder._id,
        doc,
        userId
      )
    })

    it('adds the document in Mongo', function (ctx) {
      ctx.ProjectMock.verify()
    })

    it('returns path info and the project', function (ctx) {
      expect(ctx.result).to.deep.equal({
        result: {
          path: {
            mongo: 'rootFolder.0.folders.0',
            fileSystem: '/test-folder/other.txt',
          },
        },
        project: ctx.project,
      })
    })
  })

  describe('addFile', function () {
    let userId
    beforeEach(function (ctx) {
      userId = new ObjectId().toString()
      ctx.newFile = { _id: new ObjectId(), name: 'picture.jpg' }
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: ctx.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: { 'rootFolder.0.folders.0.fileRefs': ctx.newFile },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          }
        )
        .chain('exec')
        .resolves(ctx.project)
    })

    describe('happy path', function () {
      beforeEach(async function (ctx) {
        ctx.result = await ctx.subject.promises.addFile(
          ctx.project._id,
          ctx.folder._id,
          ctx.newFile,
          userId
        )
      })

      it('adds the file in Mongo', function (ctx) {
        ctx.ProjectMock.verify()
      })

      it('returns path info and the project', function (ctx) {
        expect(ctx.result).to.deep.equal({
          result: {
            path: {
              mongo: 'rootFolder.0.folders.0',
              fileSystem: '/test-folder/picture.jpg',
            },
          },
          project: ctx.project,
        })
      })
    })

    describe('when entity limit is reached', function () {
      beforeEach(function (ctx) {
        ctx.savedMaxEntities = ctx.Settings.maxEntitiesPerProject
        ctx.Settings.maxEntitiesPerProject = 3
      })

      afterEach(function (ctx) {
        ctx.Settings.maxEntitiesPerProject = ctx.savedMaxEntities
      })

      it('should throw an error', async function (ctx) {
        await expect(
          ctx.subject.promises.addFile(
            ctx.project._id,
            ctx.folder._id,
            ctx.newFile,
            userId
          )
        ).to.be.rejected
      })
    })
  })

  describe('addFolder', function () {
    beforeEach(async function (ctx) {
      const userId = new ObjectId().toString()
      const folderName = 'New folder'
      ctx.FolderModel.withArgs({ name: folderName }).returns({
        _id: new ObjectId(),
        name: folderName,
      })
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: ctx.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: {
              'rootFolder.0.folders.0.folders': sinon.match({
                name: folderName,
              }),
            },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          }
        )
        .chain('exec')
        .resolves(ctx.project)
      await ctx.subject.promises.addFolder(
        ctx.project._id,
        ctx.folder._id,
        folderName,
        userId
      )
    })

    it('adds the folder in Mongo', function (ctx) {
      ctx.ProjectMock.verify()
    })
  })

  describe('replaceFileWithNew', function () {
    beforeEach(async function (ctx) {
      const newFile = {
        _id: new ObjectId(),
        name: 'some-other-file.png',
        linkedFileData: { some: 'data' },
        hash: 'some-hash',
      }
      // Update the file in place
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: ctx.project._id,
            'rootFolder.0.fileRefs.0': { $exists: true },
          },
          {
            $set: {
              'rootFolder.0.fileRefs.0._id': newFile._id,
              'rootFolder.0.fileRefs.0.created': sinon.match.date,
              'rootFolder.0.fileRefs.0.linkedFileData': newFile.linkedFileData,
              'rootFolder.0.fileRefs.0.hash': newFile.hash,
              lastUpdated: new Date(),
              lastUpdatedBy: 'userId',
            },
            $inc: {
              version: 1,
              'rootFolder.0.fileRefs.0.rev': 1,
            },
          }
        )
        .chain('exec')
        .resolves(ctx.project)
      ctx.ProjectLocator.findElementByMongoPath
        .withArgs(ctx.project, 'rootFolder.0.fileRefs.0')
        .returns(newFile)
      await ctx.subject.promises.replaceFileWithNew(
        ctx.project._id,
        ctx.file._id,
        newFile,
        'userId'
      )
    })

    it('updates the database', function (ctx) {
      ctx.ProjectMock.verify()
    })
  })

  describe('mkdirp', function () {
    describe('when the path is just a slash', function () {
      beforeEach(async function (ctx) {
        ctx.result = await ctx.subject.promises.mkdirp(ctx.project._id, '/')
      })

      it('should return the root folder', function (ctx) {
        expect(ctx.result.folder).to.deep.equal(ctx.rootFolder)
      })

      it('should not report a parent folder', function (ctx) {
        expect(ctx.result.folder.parentFolder_id).not.to.exist
      })

      it('should not return new folders', function (ctx) {
        expect(ctx.result.newFolders).to.have.length(0)
      })
    })

    describe('when the folder already exists', function () {
      beforeEach(async function (ctx) {
        ctx.result = await ctx.subject.promises.mkdirp(
          ctx.project._id,
          '/test-folder'
        )
      })

      it('should return the existing folder', function (ctx) {
        expect(ctx.result.folder).to.deep.equal(ctx.folder)
      })

      it('should report the parent folder', function (ctx) {
        expect(ctx.result.folder.parentFolder_id).to.equal(ctx.rootFolder._id)
      })

      it('should not return new folders', function (ctx) {
        expect(ctx.result.newFolders).to.have.length(0)
      })
    })

    describe('when the path is a new folder at the top level', function () {
      beforeEach(async function (ctx) {
        const userId = new ObjectId().toString()
        ctx.newFolder = { _id: new ObjectId(), name: 'new-folder' }
        ctx.FolderModel.returns(ctx.newFolder)
        ctx.exactCaseMatch = false
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: ctx.project._id, 'rootFolder.0': { $exists: true } },
            {
              $push: { 'rootFolder.0.folders': ctx.newFolder },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.result = await ctx.subject.promises.mkdirp(
          ctx.project._id,
          '/new-folder/',
          userId,
          { exactCaseMatch: ctx.exactCaseMatch }
        )
      })
      it('should update the database', function (ctx) {
        ctx.ProjectMock.verify()
      })

      it('should make just one folder', function (ctx) {
        expect(ctx.result.newFolders).to.have.length(1)
      })

      it('should return the new folder', function (ctx) {
        expect(ctx.result.folder.name).to.equal('new-folder')
      })

      it('should return the parent folder', function (ctx) {
        expect(ctx.result.folder.parentFolder_id).to.equal(ctx.rootFolder._id)
      })

      it('should pass the exactCaseMatch option to ProjectLocator', function (ctx) {
        expect(
          ctx.ProjectLocator.promises.findElementByPath
        ).to.have.been.calledWithMatch({ exactCaseMatch: ctx.exactCaseMatch })
      })
    })

    describe('adding a subfolder', function () {
      beforeEach(async function (ctx) {
        const userId = new ObjectId().toString()
        ctx.newFolder = { _id: new ObjectId(), name: 'new-folder' }
        ctx.FolderModel.returns(ctx.newFolder)
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: ctx.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders': sinon.match({
                  name: 'new-folder',
                }),
              },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.result = await ctx.subject.promises.mkdirp(
          ctx.project._id,
          '/test-folder/new-folder',
          userId
        )
      })

      it('should update the database', function (ctx) {
        ctx.ProjectMock.verify()
      })

      it('should create one folder', function (ctx) {
        expect(ctx.result.newFolders).to.have.length(1)
      })

      it('should return the new folder', function (ctx) {
        expect(ctx.result.folder.name).to.equal('new-folder')
      })

      it('should return the parent folder', function (ctx) {
        expect(ctx.result.folder.parentFolder_id).to.equal(ctx.folder._id)
      })
    })

    describe('when mutliple folders are missing', async function () {
      let userId
      beforeEach(function (ctx) {
        userId = new ObjectId().toString()
        ctx.folder1 = { _id: new ObjectId(), name: 'folder1' }
        ctx.folder1Path = {
          fileSystem: '/test-folder/folder1',
          mongo: 'rootFolder.0.folders.0.folders.0',
        }
        ctx.folder2 = { _id: new ObjectId(), name: 'folder2' }
        ctx.folder2Path = {
          fileSystem: '/test-folder/folder1/folder2',
          mongo: 'rootFolder.0.folders.0.folders.0.folders.0',
        }
        ctx.FolderModel.onFirstCall().returns(ctx.folder1)
        ctx.FolderModel.onSecondCall().returns(ctx.folder2)
        ctx.ProjectLocator.promises.findElement
          .withArgs({
            project: ctx.project,
            element_id: ctx.folder1._id,
            type: 'folder',
          })
          .resolves({
            element: ctx.folder1,
            path: ctx.folder1Path,
          })
        ctx.ProjectLocator.promises.findElement
          .withArgs({
            project: ctx.project,
            element_id: ctx.folder2._id,
            type: 'folder',
          })
          .resolves({
            element: ctx.folder2,
            path: ctx.folder2Path,
          })
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: ctx.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders': sinon.match({
                  name: 'folder1',
                }),
              },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: ctx.project._id,
              'rootFolder.0.folders.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders.0.folders': sinon.match({
                  name: 'folder2',
                }),
              },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
      })
      ;[
        {
          description: 'without a trailing slash',
          path: '/test-folder/folder1/folder2',
        },
        {
          description: 'with a trailing slash',
          path: '/test-folder/folder1/folder2/',
        },
      ].forEach(({ description, path }) => {
        describe(description, function () {
          beforeEach(async function (ctx) {
            ctx.result = await ctx.subject.promises.mkdirp(
              ctx.project._id,
              path,
              userId
            )
          })

          it('should update the database', function (ctx) {
            ctx.ProjectMock.verify()
          })

          it('should add multiple folders', function (ctx) {
            const newFolders = ctx.result.newFolders
            expect(newFolders).to.have.length(2)
            expect(newFolders[0].name).to.equal('folder1')
            expect(newFolders[1].name).to.equal('folder2')
          })

          it('should return the last folder', function (ctx) {
            expect(ctx.result.folder.name).to.equal('folder2')
          })

          it('should return the parent folder', function (ctx) {
            expect(ctx.result.folder.parentFolder_id).to.equal(ctx.folder1._id)
          })
        })
      })
    })
  })

  describe('moveEntity', function () {
    describe('moving a doc into a different folder', function () {
      beforeEach(async function (ctx) {
        const userId = new ObjectId().toString()
        ctx.pathAfterMove = {
          fileSystem: '/somewhere/else.txt',
        }
        ctx.oldDocs = ['old-doc']
        ctx.oldFiles = ['old-file']
        ctx.newDocs = ['new-doc']
        ctx.newFiles = ['new-file']

        ctx.ProjectEntityHandler.getAllEntitiesFromProject
          .onFirstCall()
          .returns({ docs: ctx.oldDocs, files: ctx.oldFiles })
        ctx.ProjectEntityHandler.getAllEntitiesFromProject
          .onSecondCall()
          .returns({ docs: ctx.newDocs, files: ctx.newFiles })

        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: ctx.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: { 'rootFolder.0.folders.0.docs': ctx.doc },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: ctx.project._id },
            {
              $pull: { 'rootFolder.0.docs': { _id: ctx.doc._id } },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.result = await ctx.subject.promises.moveEntity(
          ctx.project._id,
          ctx.doc._id,
          ctx.folder._id,
          'doc',
          userId
        )
      })

      it('should update the database', function (ctx) {
        ctx.ProjectMock.verify()
      })

      it('should report what changed', function (ctx) {
        expect(ctx.result).to.deep.equal({
          project: ctx.project,
          startPath: '/test-doc.txt',
          endPath: '/test-folder/test-doc.txt',
          rev: ctx.doc.rev,
          changes: {
            oldDocs: ctx.oldDocs,
            newDocs: ctx.newDocs,
            oldFiles: ctx.oldFiles,
            newFiles: ctx.newFiles,
            newProject: ctx.project,
          },
        })
      })
    })

    describe('when moving a folder inside itself', function () {
      it('throws an error', async function (ctx) {
        await expect(
          ctx.subject.promises.moveEntity(
            ctx.project._id,
            ctx.folder._id,
            ctx.folder._id,
            'folder'
          )
        ).to.be.rejectedWith(Errors.InvalidNameError)
      })
    })

    describe('when moving a folder to a subfolder of itself', function () {
      it('throws an error', async function (ctx) {
        await expect(
          ctx.subject.promises.moveEntity(
            ctx.project._id,
            ctx.folder._id,
            ctx.subfolder._id,
            'folder'
          )
        ).to.be.rejectedWith(Errors.InvalidNameError)
      })
    })

    describe('when moving a folder to a subfolder which starts with the same characters', function () {
      it('does not throw an error', async function (ctx) {
        await expect(
          ctx.subject.promises.moveEntity(
            ctx.project._id,
            ctx.folder._id,
            ctx.notSubfolder._id,
            'folder'
          )
        ).not.to.be.rejectedWith(Errors.InvalidNameError)
      })
    })
  })

  describe('deleteEntity', function () {
    beforeEach(async function (ctx) {
      const userId = new ObjectId().toString()
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: ctx.project._id },
          {
            $pull: { 'rootFolder.0.docs': { _id: ctx.doc._id } },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          }
        )
        .chain('exec')
        .resolves(ctx.project)
      await ctx.subject.promises.deleteEntity(
        ctx.project._id,
        ctx.doc._id,
        'doc',
        userId
      )
    })

    it('should update the database', function (ctx) {
      ctx.ProjectMock.verify()
    })
  })

  describe('renameEntity', function () {
    describe('happy path', function () {
      beforeEach(async function (ctx) {
        const userId = new ObjectId().toString()
        ctx.newName = 'new.tex'
        ctx.oldDocs = ['old-doc']
        ctx.oldFiles = ['old-file']
        ctx.newDocs = ['new-doc']
        ctx.newFiles = ['new-file']

        ctx.ProjectEntityHandler.getAllEntitiesFromProject
          .onFirstCall()
          .returns({ docs: ctx.oldDocs, files: ctx.oldFiles })
        ctx.ProjectEntityHandler.getAllEntitiesFromProject
          .onSecondCall()
          .returns({ docs: ctx.newDocs, files: ctx.newFiles })

        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: ctx.project._id, 'rootFolder.0.docs.0': { $exists: true } },
            {
              $set: {
                'rootFolder.0.docs.0.name': ctx.newName,
                lastUpdated: new Date(),
                lastUpdatedBy: userId,
              },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        ctx.result = await ctx.subject.promises.renameEntity(
          ctx.project._id,
          ctx.doc._id,
          'doc',
          ctx.newName,
          userId
        )
      })

      it('should update the database', function (ctx) {
        ctx.ProjectMock.verify()
      })

      it('returns info', function (ctx) {
        expect(ctx.result).to.deep.equal({
          project: ctx.project,
          startPath: '/test-doc.txt',
          endPath: '/new.tex',
          rev: ctx.doc.rev,
          changes: {
            oldDocs: ctx.oldDocs,
            newDocs: ctx.newDocs,
            oldFiles: ctx.oldFiles,
            newFiles: ctx.newFiles,
            newProject: ctx.project,
          },
        })
      })
    })

    describe('name already exists', function () {
      it('should throw an error', async function (ctx) {
        await expect(
          ctx.subject.promises.renameEntity(
            ctx.project._id,
            ctx.doc._id,
            'doc',
            ctx.folder.name
          )
        ).to.be.rejectedWith(Errors.DuplicateNameError)
      })
    })
  })

  describe('_putElement', function () {
    describe('updating the project', function () {
      describe('when the parent folder is given', function () {
        let userId
        beforeEach(function (ctx) {
          userId = new ObjectId().toString()
          ctx.newFile = { _id: new ObjectId(), name: 'new file.png' }
          ctx.ProjectMock.expects('findOneAndUpdate')
            .withArgs(
              {
                _id: ctx.project._id,
                'rootFolder.0.folders.0': { $exists: true },
              },
              {
                $push: { 'rootFolder.0.folders.0.fileRefs': ctx.newFile },
                $inc: { version: 1 },
                $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
              }
            )
            .chain('exec')
            .resolves(ctx.project)
        })

        it('should update the database', async function (ctx) {
          await ctx.subject.promises._putElement(
            ctx.project,
            ctx.folder._id,
            ctx.newFile,
            'files',
            userId
          )
          ctx.ProjectMock.verify()
        })

        it('should add an s onto the type if not included', async function (ctx) {
          await ctx.subject.promises._putElement(
            ctx.project,
            ctx.folder._id,
            ctx.newFile,
            'file',
            userId
          )
          ctx.ProjectMock.verify()
        })
      })

      describe('error cases', function () {
        it('should throw an error if element is null', async function (ctx) {
          await expect(
            ctx.subject.promises._putElement(
              ctx.project,
              ctx.folder._id,
              null,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if the element has no _id', async function (ctx) {
          const file = { name: 'something' }
          await expect(
            ctx.subject.promises._putElement(
              ctx.project,
              ctx.folder._id,
              file,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if element name contains invalid characters', async function (ctx) {
          const file = { _id: new ObjectId(), name: 'something*bad' }
          await expect(
            ctx.subject.promises._putElement(
              ctx.project,
              ctx.folder._id,
              file,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if element name is too long', async function (ctx) {
          const file = {
            _id: new ObjectId(),
            name: 'long-'.repeat(1000) + 'something',
          }
          await expect(
            ctx.subject.promises._putElement(
              ctx.project,
              ctx.folder._id,
              file,
              'file'
            )
          ).to.be.rejectedWith(Errors.InvalidNameError)
        })

        it('should error if the folder name is too long', async function (ctx) {
          const file = {
            _id: new ObjectId(),
            name: 'something',
          }
          ctx.ProjectLocator.promises.findElement
            .withArgs({
              project: ctx.project,
              element_id: ctx.folder._id,
              type: 'folder',
            })
            .resolves({
              element: ctx.folder,
              path: { fileSystem: 'subdir/'.repeat(1000) + 'foo' },
            })
          await expect(
            ctx.subject.promises._putElement(
              ctx.project,
              ctx.folder._id,
              file,
              'file'
            )
          ).to.be.rejectedWith(Errors.InvalidNameError)
        })
        ;['file', 'doc', 'folder'].forEach(entityType => {
          it(`should error if a ${entityType} already exists with the same name`, async function (ctx) {
            const file = {
              _id: new ObjectId(),
              name: ctx[entityType].name,
            }
            await expect(
              ctx.subject.promises._putElement(ctx.project, null, file, 'file')
            ).to.be.rejectedWith(Errors.DuplicateNameError)
          })
        })
      })
    })

    describe('when the parent folder is not given', function () {
      it('should default to root folder insert', async function (ctx) {
        const userId = new ObjectId().toString()
        ctx.newFile = { _id: new ObjectId(), name: 'new file.png' }
        ctx.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: ctx.project._id, 'rootFolder.0': { $exists: true } },
            {
              $push: { 'rootFolder.0.fileRefs': ctx.newFile },
              $inc: { version: 1 },
              $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
            }
          )
          .chain('exec')
          .resolves(ctx.project)
        await ctx.subject.promises._putElement(
          ctx.project,
          ctx.rootFolder._id,
          ctx.newFile,
          'file',
          userId
        )
      })
    })
  })

  describe('createNewFolderStructure', function () {
    beforeEach(function (ctx) {
      ctx.mockRootFolder = 'MOCK_ROOT_FOLDER'
      ctx.docUploads = ['MOCK_DOC_UPLOAD']
      ctx.fileUploads = ['MOCK_FILE_UPLOAD']
      ctx.FolderStructureBuilder.buildFolderStructure
        .withArgs(ctx.docUploads, ctx.fileUploads)
        .returns(ctx.mockRootFolder)
      ctx.updateExpectation = ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: ctx.project._id,
            'rootFolder.0.folders.0': { $exists: false },
            'rootFolder.0.docs.0': { $exists: false },
            'rootFolder.0.files.0': { $exists: false },
          },
          { $set: { rootFolder: [ctx.mockRootFolder] }, $inc: { version: 1 } },
          { new: true, lean: true, fields: { version: 1 } }
        )
        .chain('exec')
    })

    describe('happy path', function () {
      beforeEach(async function (ctx) {
        ctx.updateExpectation.resolves({ version: 1 })
        await ctx.subject.promises.createNewFolderStructure(
          ctx.project._id,
          ctx.docUploads,
          ctx.fileUploads
        )
      })

      it('updates the database', function (ctx) {
        ctx.ProjectMock.verify()
      })
    })

    describe("when the update doesn't find a matching document", function () {
      beforeEach(async function (ctx) {
        ctx.updateExpectation.resolves(null)
      })

      it('throws an error', async function (ctx) {
        await expect(
          ctx.subject.promises.createNewFolderStructure(
            ctx.project._id,
            ctx.docUploads,
            ctx.fileUploads
          )
        ).to.be.rejected
      })
    })
  })

  describe('replaceDocWithFile', function () {
    it('should simultaneously remove the doc and add the file', async function (ctx) {
      const userId = new ObjectId().toString()
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: ctx.project._id, 'rootFolder.0': { $exists: true } },
          {
            $pull: { 'rootFolder.0.docs': { _id: ctx.doc._id } },
            $push: { 'rootFolder.0.fileRefs': ctx.file },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          },
          { new: true }
        )
        .chain('exec')
        .resolves(ctx.project)
      await ctx.subject.promises.replaceDocWithFile(
        ctx.project._id,
        ctx.doc._id,
        ctx.file,
        userId
      )
      ctx.ProjectMock.verify()
    })
  })

  describe('replaceFileWithDoc', function () {
    it('should simultaneously remove the file and add the doc', async function (ctx) {
      const userId = new ObjectId().toString()
      ctx.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: ctx.project._id, 'rootFolder.0': { $exists: true } },
          {
            $pull: { 'rootFolder.0.fileRefs': { _id: ctx.file._id } },
            $push: { 'rootFolder.0.docs': ctx.doc },
            $inc: { version: 1 },
            $set: { lastUpdated: new Date(), lastUpdatedBy: userId },
          },
          { new: true }
        )
        .chain('exec')
        .resolves(ctx.project)
      await ctx.subject.promises.replaceFileWithDoc(
        ctx.project._id,
        ctx.file._id,
        ctx.doc,
        userId
      )
      ctx.ProjectMock.verify()
    })
  })
})
