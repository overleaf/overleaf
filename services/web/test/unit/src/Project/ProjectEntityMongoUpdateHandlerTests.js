const { expect } = require('chai')
const sinon = require('sinon')
const tk = require('timekeeper')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const { ObjectId } = require('mongodb-legacy')
const SandboxedModule = require('sandboxed-module')
const { DeletedFile } = require('../helpers/models/DeletedFile')
const { Project } = require('../helpers/models/Project')

const MODULE_PATH =
  '../../../../app/src/Features/Project/ProjectEntityMongoUpdateHandler'

describe('ProjectEntityMongoUpdateHandler', function () {
  beforeEach(function () {
    this.doc = {
      _id: new ObjectId(),
      name: 'test-doc.txt',
      lines: ['hello', 'world'],
      rev: 1234,
    }
    this.docPath = {
      mongo: 'rootFolder.0.docs.0',
      fileSystem: '/test-doc.txt',
    }
    this.file = {
      _id: new ObjectId(),
      name: 'something.jpg',
      linkedFileData: { provider: 'url' },
      hash: 'some-hash',
    }
    this.filePath = {
      fileSystem: '/something.png',
      mongo: 'rootFolder.0.fileRefs.0',
    }
    this.subfolder = { _id: new ObjectId(), name: 'test-subfolder' }
    this.subfolderPath = {
      fileSystem: '/test-folder/test-subfolder',
      mongo: 'rootFolder.0.folders.0.folders.0',
    }
    this.notSubfolder = { _id: new ObjectId(), name: 'test-folder-2' }
    this.notSubfolderPath = {
      fileSystem: '/test-folder-2/test-subfolder',
      mongo: 'rootFolder.0.folders.0.folders.0',
    }
    this.folder = {
      _id: new ObjectId(),
      name: 'test-folder',
      folders: [this.subfolder],
    }
    this.folderPath = {
      fileSystem: '/test-folder',
      mongo: 'rootFolder.0.folders.0',
    }
    this.rootFolder = {
      _id: new ObjectId(),
      folders: [this.folder],
      docs: [this.doc],
      fileRefs: [this.file],
    }
    this.rootFolderPath = {
      fileSystem: '/',
      mongo: 'rootFolder.0',
    }
    this.project = {
      _id: new ObjectId(),
      name: 'project name',
      rootFolder: [this.rootFolder],
    }

    this.Settings = { maxEntitiesPerProject: 100 }
    this.CooldownManager = {}
    this.LockManager = {
      promises: {
        runWithLock: sinon.spy((namespace, id, runner) => runner()),
      },
    }

    this.FolderModel = sinon.stub()
    this.DeletedFileMock = sinon.mock(DeletedFile)
    this.ProjectMock = sinon.mock(Project)
    this.ProjectEntityHandler = {
      getAllEntitiesFromProject: sinon.stub(),
    }
    this.ProjectLocator = {
      findElementByMongoPath: sinon.stub().throws(new Error('not found')),
      promises: {
        findElement: sinon.stub().rejects(new Error('not found')),
        findElementByPath: sinon.stub().rejects(new Error('not found')),
      },
    }
    this.ProjectLocator.promises.findElement
      .withArgs({
        project: this.project,
        element_id: this.rootFolder._id,
        type: 'folder',
      })
      .resolves({
        element: this.rootFolder,
        path: this.rootFolderPath,
      })
    this.ProjectLocator.promises.findElement
      .withArgs({
        project: this.project,
        element_id: this.folder._id,
        type: 'folder',
      })
      .resolves({
        element: this.folder,
        path: this.folderPath,
        folder: this.rootFolder,
      })
    this.ProjectLocator.promises.findElement
      .withArgs({
        project: this.project,
        element_id: this.subfolder._id,
        type: 'folder',
      })
      .resolves({
        element: this.subfolder,
        path: this.subfolderPath,
        folder: this.folder,
      })
    this.ProjectLocator.promises.findElement
      .withArgs({
        project: this.project,
        element_id: this.file._id,
        type: 'file',
      })
      .resolves({
        element: this.file,
        path: this.filePath,
        folder: this.rootFolder,
      })
    this.ProjectLocator.promises.findElement
      .withArgs({
        project: this.project,
        element_id: this.doc._id,
        type: 'doc',
      })
      .resolves({
        element: this.doc,
        path: this.docPath,
        folder: this.rootFolder,
      })
    this.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: this.project,
          path: '/',
        })
      )
      .resolves({ element: this.rootFolder, type: 'folder', folder: null })
    this.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: this.project,
          path: '/test-folder',
        })
      )
      .resolves({
        element: this.folder,
        type: 'folder',
        folder: this.rootFolder,
      })
    this.ProjectLocator.promises.findElementByPath
      .withArgs(
        sinon.match({
          project: this.project,
          path: '/test-folder/test-subfolder',
        })
      )
      .resolves({
        element: this.subfolder,
        type: 'folder',
        folder: this.folder,
      })

    this.ProjectGetter = {
      promises: {
        getProjectWithoutLock: sinon
          .stub()
          .withArgs(this.project._id)
          .resolves(this.project),
        getProjectWithOnlyFolders: sinon.stub().resolves(this.project),
      },
    }

    this.FolderStructureBuilder = {
      buildFolderStructure: sinon.stub(),
    }

    this.subject = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '@overleaf/settings': this.Settings,
        '../Cooldown/CooldownManager': this.CooldownManager,
        '../../models/Folder': { Folder: this.FolderModel },
        '../../infrastructure/LockManager': this.LockManager,
        '../../models/DeletedFile': { DeletedFile },
        '../../models/Project': { Project },
        './ProjectEntityHandler': this.ProjectEntityHandler,
        './ProjectLocator': this.ProjectLocator,
        './ProjectGetter': this.ProjectGetter,
        './FolderStructureBuilder': this.FolderStructureBuilder,
      },
    })
  })

  afterEach(function () {
    this.DeletedFileMock.restore()
    this.ProjectMock.restore()
  })

  beforeEach(function () {
    tk.freeze(Date.now())
  })

  afterEach(function () {
    tk.reset()
  })

  describe('addDoc', function () {
    beforeEach(async function () {
      const doc = { _id: new ObjectId(), name: 'other.txt' }
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: this.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: { 'rootFolder.0.folders.0.docs': doc },
            $inc: { version: 1 },
          }
        )
        .chain('exec')
        .resolves(this.project)
      this.result = await this.subject.promises.addDoc(
        this.project._id,
        this.folder._id,
        doc
      )
    })

    it('adds the document in Mongo', function () {
      this.ProjectMock.verify()
    })

    it('returns path info and the project', function () {
      expect(this.result).to.deep.equal({
        result: {
          path: {
            mongo: 'rootFolder.0.folders.0',
            fileSystem: '/test-folder/other.txt',
          },
        },
        project: this.project,
      })
    })
  })

  describe('addFile', function () {
    beforeEach(function () {
      this.newFile = { _id: new ObjectId(), name: 'picture.jpg' }
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: this.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: { 'rootFolder.0.folders.0.fileRefs': this.newFile },
            $inc: { version: 1 },
          }
        )
        .chain('exec')
        .resolves(this.project)
    })

    describe('happy path', function () {
      beforeEach(async function () {
        this.result = await this.subject.promises.addFile(
          this.project._id,
          this.folder._id,
          this.newFile
        )
      })

      it('adds the file in Mongo', function () {
        this.ProjectMock.verify()
      })

      it('returns path info and the project', function () {
        expect(this.result).to.deep.equal({
          result: {
            path: {
              mongo: 'rootFolder.0.folders.0',
              fileSystem: '/test-folder/picture.jpg',
            },
          },
          project: this.project,
        })
      })
    })

    describe('when entity limit is reached', function () {
      beforeEach(function () {
        this.savedMaxEntities = this.Settings.maxEntitiesPerProject
        this.Settings.maxEntitiesPerProject = 3
      })

      afterEach(function () {
        this.Settings.maxEntitiesPerProject = this.savedMaxEntities
      })

      it('should throw an error', async function () {
        await expect(
          this.subject.promises.addFile(
            this.project._id,
            this.folder._id,
            this.newFile
          )
        ).to.be.rejected
      })
    })
  })

  describe('addFolder', function () {
    beforeEach(async function () {
      const folderName = 'New folder'
      this.FolderModel.withArgs({ name: folderName }).returns({
        _id: new ObjectId(),
        name: folderName,
      })
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: this.project._id,
            'rootFolder.0.folders.0': { $exists: true },
          },
          {
            $push: {
              'rootFolder.0.folders.0.folders': sinon.match({
                name: folderName,
              }),
            },
            $inc: { version: 1 },
          }
        )
        .chain('exec')
        .resolves(this.project)
      await this.subject.promises.addFolder(
        this.project._id,
        this.folder._id,
        folderName
      )
    })

    it('adds the folder in Mongo', function () {
      this.ProjectMock.verify()
    })
  })

  describe('replaceFileWithNew', function () {
    beforeEach(async function () {
      const newFile = {
        _id: new ObjectId(),
        name: 'some-other-file.png',
        linkedFileData: { some: 'data' },
        hash: 'some-hash',
      }
      // Add a deleted file record
      this.DeletedFileMock.expects('create')
        .withArgs({
          projectId: this.project._id,
          _id: this.file._id,
          name: this.file.name,
          linkedFileData: this.file.linkedFileData,
          hash: this.file.hash,
          deletedAt: sinon.match.date,
        })
        .resolves()
      // Update the file in place
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: this.project._id,
            'rootFolder.0.fileRefs.0': { $exists: true },
          },
          {
            $set: {
              'rootFolder.0.fileRefs.0._id': newFile._id,
              'rootFolder.0.fileRefs.0.created': sinon.match.date,
              'rootFolder.0.fileRefs.0.linkedFileData': newFile.linkedFileData,
              'rootFolder.0.fileRefs.0.hash': newFile.hash,
            },
            $inc: {
              version: 1,
              'rootFolder.0.fileRefs.0.rev': 1,
            },
          }
        )
        .chain('exec')
        .resolves(this.project)
      this.ProjectLocator.findElementByMongoPath
        .withArgs(this.project, 'rootFolder.0.fileRefs.0')
        .returns(newFile)
      await this.subject.promises.replaceFileWithNew(
        this.project._id,
        this.file._id,
        newFile
      )
    })

    it('updates the database', function () {
      this.DeletedFileMock.verify()
      this.ProjectMock.verify()
    })
  })

  describe('mkdirp', function () {
    describe('when the path is just a slash', function () {
      beforeEach(async function () {
        this.result = await this.subject.promises.mkdirp(this.project._id, '/')
      })

      it('should return the root folder', function () {
        expect(this.result.folder).to.deep.equal(this.rootFolder)
      })

      it('should not report a parent folder', function () {
        expect(this.result.folder.parentFolder_id).not.to.exist
      })

      it('should not return new folders', function () {
        expect(this.result.newFolders).to.have.length(0)
      })
    })

    describe('when the folder already exists', function () {
      beforeEach(async function () {
        this.result = await this.subject.promises.mkdirp(
          this.project._id,
          '/test-folder'
        )
      })

      it('should return the existing folder', function () {
        expect(this.result.folder).to.deep.equal(this.folder)
      })

      it('should report the parent folder', function () {
        expect(this.result.folder.parentFolder_id).to.equal(this.rootFolder._id)
      })

      it('should not return new folders', function () {
        expect(this.result.newFolders).to.have.length(0)
      })
    })

    describe('when the path is a new folder at the top level', function () {
      beforeEach(async function () {
        this.newFolder = { _id: new ObjectId(), name: 'new-folder' }
        this.FolderModel.returns(this.newFolder)
        this.exactCaseMatch = false
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: this.project._id, 'rootFolder.0': { $exists: true } },
            {
              $push: { 'rootFolder.0.folders': this.newFolder },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.result = await this.subject.promises.mkdirp(
          this.project._id,
          '/new-folder/',
          { exactCaseMatch: this.exactCaseMatch }
        )
      })
      it('should update the database', function () {
        this.ProjectMock.verify()
      })

      it('should make just one folder', function () {
        expect(this.result.newFolders).to.have.length(1)
      })

      it('should return the new folder', function () {
        expect(this.result.folder.name).to.equal('new-folder')
      })

      it('should return the parent folder', function () {
        expect(this.result.folder.parentFolder_id).to.equal(this.rootFolder._id)
      })

      it('should pass the exactCaseMatch option to ProjectLocator', function () {
        expect(
          this.ProjectLocator.promises.findElementByPath
        ).to.have.been.calledWithMatch({ exactCaseMatch: this.exactCaseMatch })
      })
    })

    describe('adding a subfolder', function () {
      beforeEach(async function () {
        this.newFolder = { _id: new ObjectId(), name: 'new-folder' }
        this.FolderModel.returns(this.newFolder)
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: this.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders': sinon.match({
                  name: 'new-folder',
                }),
              },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.result = await this.subject.promises.mkdirp(
          this.project._id,
          '/test-folder/new-folder'
        )
      })

      it('should update the database', function () {
        this.ProjectMock.verify()
      })

      it('should create one folder', function () {
        expect(this.result.newFolders).to.have.length(1)
      })

      it('should return the new folder', function () {
        expect(this.result.folder.name).to.equal('new-folder')
      })

      it('should return the parent folder', function () {
        expect(this.result.folder.parentFolder_id).to.equal(this.folder._id)
      })
    })

    describe('when mutliple folders are missing', async function () {
      beforeEach(function () {
        this.folder1 = { _id: new ObjectId(), name: 'folder1' }
        this.folder1Path = {
          fileSystem: '/test-folder/folder1',
          mongo: 'rootFolder.0.folders.0.folders.0',
        }
        this.folder2 = { _id: new ObjectId(), name: 'folder2' }
        this.folder2Path = {
          fileSystem: '/test-folder/folder1/folder2',
          mongo: 'rootFolder.0.folders.0.folders.0.folders.0',
        }
        this.FolderModel.onFirstCall().returns(this.folder1)
        this.FolderModel.onSecondCall().returns(this.folder2)
        this.ProjectLocator.promises.findElement
          .withArgs({
            project: this.project,
            element_id: this.folder1._id,
            type: 'folder',
          })
          .resolves({
            element: this.folder1,
            path: this.folder1Path,
          })
        this.ProjectLocator.promises.findElement
          .withArgs({
            project: this.project,
            element_id: this.folder2._id,
            type: 'folder',
          })
          .resolves({
            element: this.folder2,
            path: this.folder2Path,
          })
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: this.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders': sinon.match({
                  name: 'folder1',
                }),
              },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: this.project._id,
              'rootFolder.0.folders.0.folders.0': { $exists: true },
            },
            {
              $push: {
                'rootFolder.0.folders.0.folders.0.folders': sinon.match({
                  name: 'folder2',
                }),
              },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
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
          beforeEach(async function () {
            this.result = await this.subject.promises.mkdirp(
              this.project._id,
              path
            )
          })

          it('should update the database', function () {
            this.ProjectMock.verify()
          })

          it('should add multiple folders', function () {
            const newFolders = this.result.newFolders
            expect(newFolders).to.have.length(2)
            expect(newFolders[0].name).to.equal('folder1')
            expect(newFolders[1].name).to.equal('folder2')
          })

          it('should return the last folder', function () {
            expect(this.result.folder.name).to.equal('folder2')
          })

          it('should return the parent folder', function () {
            expect(this.result.folder.parentFolder_id).to.equal(
              this.folder1._id
            )
          })
        })
      })
    })
  })

  describe('moveEntity', function () {
    describe('moving a doc into a different folder', function () {
      beforeEach(async function () {
        this.pathAfterMove = {
          fileSystem: '/somewhere/else.txt',
        }
        this.oldDocs = ['old-doc']
        this.oldFiles = ['old-file']
        this.newDocs = ['new-doc']
        this.newFiles = ['new-file']

        this.ProjectEntityHandler.getAllEntitiesFromProject
          .onFirstCall()
          .returns({ docs: this.oldDocs, files: this.oldFiles })
        this.ProjectEntityHandler.getAllEntitiesFromProject
          .onSecondCall()
          .returns({ docs: this.newDocs, files: this.newFiles })

        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            {
              _id: this.project._id,
              'rootFolder.0.folders.0': { $exists: true },
            },
            {
              $push: { 'rootFolder.0.folders.0.docs': this.doc },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: this.project._id },
            {
              $pull: { 'rootFolder.0.docs': { _id: this.doc._id } },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.result = await this.subject.promises.moveEntity(
          this.project._id,
          this.doc._id,
          this.folder._id,
          'doc'
        )
      })

      it('should update the database', function () {
        this.ProjectMock.verify()
      })

      it('should report what changed', function () {
        expect(this.result).to.deep.equal({
          project: this.project,
          startPath: '/test-doc.txt',
          endPath: '/test-folder/test-doc.txt',
          rev: this.doc.rev,
          changes: {
            oldDocs: this.oldDocs,
            newDocs: this.newDocs,
            oldFiles: this.oldFiles,
            newFiles: this.newFiles,
            newProject: this.project,
          },
        })
      })
    })

    describe('when moving a folder inside itself', function () {
      it('throws an error', async function () {
        await expect(
          this.subject.promises.moveEntity(
            this.project._id,
            this.folder._id,
            this.folder._id,
            'folder'
          )
        ).to.be.rejectedWith(Errors.InvalidNameError)
      })
    })

    describe('when moving a folder to a subfolder of itself', function () {
      it('throws an error', async function () {
        await expect(
          this.subject.promises.moveEntity(
            this.project._id,
            this.folder._id,
            this.subfolder._id,
            'folder'
          )
        ).to.be.rejectedWith(Errors.InvalidNameError)
      })
    })

    describe('when moving a folder to a subfolder which starts with the same characters', function () {
      it('does not throw an error', async function () {
        await expect(
          this.subject.promises.moveEntity(
            this.project._id,
            this.folder._id,
            this.notSubfolder._id,
            'folder'
          )
        ).not.to.be.rejectedWith(Errors.InvalidNameError)
      })
    })
  })

  describe('deleteEntity', function () {
    beforeEach(async function () {
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: this.project._id },
          {
            $pull: { 'rootFolder.0.docs': { _id: this.doc._id } },
            $inc: { version: 1 },
          }
        )
        .chain('exec')
        .resolves(this.project)
      await this.subject.promises.deleteEntity(
        this.project._id,
        this.doc._id,
        'doc'
      )
    })

    it('should update the database', function () {
      this.ProjectMock.verify()
    })
  })

  describe('renameEntity', function () {
    describe('happy path', function () {
      beforeEach(async function () {
        this.newName = 'new.tex'
        this.oldDocs = ['old-doc']
        this.oldFiles = ['old-file']
        this.newDocs = ['new-doc']
        this.newFiles = ['new-file']

        this.ProjectEntityHandler.getAllEntitiesFromProject
          .onFirstCall()
          .returns({ docs: this.oldDocs, files: this.oldFiles })
        this.ProjectEntityHandler.getAllEntitiesFromProject
          .onSecondCall()
          .returns({ docs: this.newDocs, files: this.newFiles })

        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: this.project._id, 'rootFolder.0.docs.0': { $exists: true } },
            {
              $set: { 'rootFolder.0.docs.0.name': this.newName },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        this.result = await this.subject.promises.renameEntity(
          this.project._id,
          this.doc._id,
          'doc',
          this.newName
        )
      })

      it('should update the database', function () {
        this.ProjectMock.verify()
      })

      it('returns info', function () {
        expect(this.result).to.deep.equal({
          project: this.project,
          startPath: '/test-doc.txt',
          endPath: '/new.tex',
          rev: this.doc.rev,
          changes: {
            oldDocs: this.oldDocs,
            newDocs: this.newDocs,
            oldFiles: this.oldFiles,
            newFiles: this.newFiles,
            newProject: this.project,
          },
        })
      })
    })

    describe('name already exists', function () {
      it('should throw an error', async function () {
        await expect(
          this.subject.promises.renameEntity(
            this.project._id,
            this.doc._id,
            'doc',
            this.folder.name
          )
        ).to.be.rejectedWith(Errors.DuplicateNameError)
      })
    })
  })

  describe('_putElement', function () {
    describe('updating the project', function () {
      describe('when the parent folder is given', function () {
        beforeEach(function () {
          this.newFile = { _id: new ObjectId(), name: 'new file.png' }
          this.ProjectMock.expects('findOneAndUpdate')
            .withArgs(
              {
                _id: this.project._id,
                'rootFolder.0.folders.0': { $exists: true },
              },
              {
                $push: { 'rootFolder.0.folders.0.fileRefs': this.newFile },
                $inc: { version: 1 },
              }
            )
            .chain('exec')
            .resolves(this.project)
        })

        it('should update the database', async function () {
          await this.subject.promises._putElement(
            this.project,
            this.folder._id,
            this.newFile,
            'files'
          )
          this.ProjectMock.verify()
        })

        it('should add an s onto the type if not included', async function () {
          await this.subject.promises._putElement(
            this.project,
            this.folder._id,
            this.newFile,
            'file'
          )
          this.ProjectMock.verify()
        })
      })

      describe('error cases', function () {
        it('should throw an error if element is null', async function () {
          await expect(
            this.subject.promises._putElement(
              this.project,
              this.folder._id,
              null,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if the element has no _id', async function () {
          const file = { name: 'something' }
          await expect(
            this.subject.promises._putElement(
              this.project,
              this.folder._id,
              file,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if element name contains invalid characters', async function () {
          const file = { _id: new ObjectId(), name: 'something*bad' }
          await expect(
            this.subject.promises._putElement(
              this.project,
              this.folder._id,
              file,
              'file'
            )
          ).to.be.rejected
        })

        it('should error if element name is too long', async function () {
          const file = {
            _id: new ObjectId(),
            name: 'long-'.repeat(1000) + 'something',
          }
          await expect(
            this.subject.promises._putElement(
              this.project,
              this.folder._id,
              file,
              'file'
            )
          ).to.be.rejectedWith(Errors.InvalidNameError)
        })

        it('should error if the folder name is too long', async function () {
          const file = {
            _id: new ObjectId(),
            name: 'something',
          }
          this.ProjectLocator.promises.findElement
            .withArgs({
              project: this.project,
              element_id: this.folder._id,
              type: 'folder',
            })
            .resolves({
              element: this.folder,
              path: { fileSystem: 'subdir/'.repeat(1000) + 'foo' },
            })
          await expect(
            this.subject.promises._putElement(
              this.project,
              this.folder._id,
              file,
              'file'
            )
          ).to.be.rejectedWith(Errors.InvalidNameError)
        })
        ;['file', 'doc', 'folder'].forEach(entityType => {
          it(`should error if a ${entityType} already exists with the same name`, async function () {
            const file = {
              _id: new ObjectId(),
              name: this[entityType].name,
            }
            await expect(
              this.subject.promises._putElement(
                this.project,
                null,
                file,
                'file'
              )
            ).to.be.rejectedWith(Errors.DuplicateNameError)
          })
        })
      })
    })

    describe('when the parent folder is not given', function () {
      it('should default to root folder insert', async function () {
        this.newFile = { _id: new ObjectId(), name: 'new file.png' }
        this.ProjectMock.expects('findOneAndUpdate')
          .withArgs(
            { _id: this.project._id, 'rootFolder.0': { $exists: true } },
            {
              $push: { 'rootFolder.0.fileRefs': this.newFile },
              $inc: { version: 1 },
            }
          )
          .chain('exec')
          .resolves(this.project)
        await this.subject.promises._putElement(
          this.project,
          this.rootFolder._id,
          this.newFile,
          'file'
        )
      })
    })
  })

  describe('_insertDeletedFileReference', function () {
    beforeEach(async function () {
      this.DeletedFileMock.expects('create')
        .withArgs({
          projectId: this.project._id,
          _id: this.file._id,
          name: this.file.name,
          linkedFileData: this.file.linkedFileData,
          hash: this.file.hash,
          deletedAt: sinon.match.date,
        })
        .resolves()
      await this.subject.promises._insertDeletedFileReference(
        this.project._id,
        this.file
      )
    })

    it('should update the database', function () {
      this.DeletedFileMock.verify()
    })
  })

  describe('createNewFolderStructure', function () {
    beforeEach(function () {
      this.mockRootFolder = 'MOCK_ROOT_FOLDER'
      this.docUploads = ['MOCK_DOC_UPLOAD']
      this.fileUploads = ['MOCK_FILE_UPLOAD']
      this.FolderStructureBuilder.buildFolderStructure
        .withArgs(this.docUploads, this.fileUploads)
        .returns(this.mockRootFolder)
      this.updateExpectation = this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          {
            _id: this.project._id,
            'rootFolder.0.folders.0': { $exists: false },
            'rootFolder.0.docs.0': { $exists: false },
            'rootFolder.0.files.0': { $exists: false },
          },
          { $set: { rootFolder: [this.mockRootFolder] }, $inc: { version: 1 } },
          { new: true, lean: true, fields: { version: 1 } }
        )
        .chain('exec')
    })

    describe('happy path', function () {
      beforeEach(async function () {
        this.updateExpectation.resolves({ version: 1 })
        await this.subject.promises.createNewFolderStructure(
          this.project._id,
          this.docUploads,
          this.fileUploads
        )
      })

      it('updates the database', function () {
        this.ProjectMock.verify()
      })
    })

    describe("when the update doesn't find a matching document", function () {
      beforeEach(async function () {
        this.updateExpectation.resolves(null)
      })

      it('throws an error', async function () {
        await expect(
          this.subject.promises.createNewFolderStructure(
            this.project._id,
            this.docUploads,
            this.fileUploads
          )
        ).to.be.rejected
      })
    })
  })

  describe('replaceDocWithFile', function () {
    it('should simultaneously remove the doc and add the file', async function () {
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: this.project._id, 'rootFolder.0': { $exists: true } },
          {
            $pull: { 'rootFolder.0.docs': { _id: this.doc._id } },
            $push: { 'rootFolder.0.fileRefs': this.file },
            $inc: { version: 1 },
          },
          { new: true }
        )
        .chain('exec')
        .resolves(this.project)
      await this.subject.promises.replaceDocWithFile(
        this.project._id,
        this.doc._id,
        this.file
      )
      this.ProjectMock.verify()
    })
  })

  describe('replaceFileWithDoc', function () {
    it('should simultaneously remove the file and add the doc', async function () {
      this.ProjectMock.expects('findOneAndUpdate')
        .withArgs(
          { _id: this.project._id, 'rootFolder.0': { $exists: true } },
          {
            $pull: { 'rootFolder.0.fileRefs': { _id: this.file._id } },
            $push: { 'rootFolder.0.docs': this.doc },
            $inc: { version: 1 },
          },
          { new: true }
        )
        .chain('exec')
        .resolves(this.project)
      await this.subject.promises.replaceFileWithDoc(
        this.project._id,
        this.file._id,
        this.doc
      )
      this.ProjectMock.verify()
    })
  })
})
