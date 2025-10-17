import { vi, expect } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
const modulePath = '../../../../app/src/Features/Project/ProjectEntityHandler'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('ProjectEntityHandler', function () {
  const projectId = '4eecb1c1bffa66588e0000a1'
  const docId = '4eecb1c1bffa66588e0000a2'

  beforeEach(async function (ctx) {
    ctx.TpdsUpdateSender = {
      addDoc: sinon.stub().callsArg(1),
      addFile: sinon.stub().callsArg(1),
    }
    ctx.ProjectModel = class Project {
      constructor(options) {
        this._id = projectId
        this.name = 'project_name_here'
        this.rev = 0
        this.rootFolder = [this.rootFolder]
      }
    }
    ctx.project = new ctx.ProjectModel()

    ctx.ProjectLocator = { findElement: sinon.stub() }
    ctx.DocumentUpdaterHandler = {
      updateProjectStructure: sinon.stub().yields(),
    }
    ctx.callback = sinon.stub()

    vi.doMock('../../../../app/src/Features/Docstore/DocstoreManager', () => ({
      default: (ctx.DocstoreManager = {
        promises: {},
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/DocumentUpdater/DocumentUpdaterHandler',
      () => ({
        default: ctx.DocumentUpdaterHandler,
      })
    )

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project: ctx.ProjectModel,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectLocator', () => ({
      default: ctx.ProjectLocator,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: (ctx.ProjectGetter = { promises: {} }),
    }))

    vi.doMock(
      '../../../../app/src/Features/ThirdPartyDataStore/TpdsUpdateSender',
      () => ({
        default: ctx.TpdsUpdateSender,
      })
    )

    ctx.ProjectEntityHandler = (await import(modulePath)).default
  })

  describe('getting folders, docs and files', function () {
    beforeEach(function (ctx) {
      ctx.project.rootFolder = [
        {
          docs: [
            (ctx.doc1 = {
              name: 'doc1',
              _id: 'doc1_id',
            }),
          ],
          fileRefs: [
            (ctx.file1 = {
              rev: 1,
              _id: 'file1_id',
              name: 'file1',
            }),
          ],
          folders: [
            (ctx.folder1 = {
              name: 'folder1',
              docs: [
                (ctx.doc2 = {
                  name: 'doc2',
                  _id: 'doc2_id',
                }),
              ],
              fileRefs: [
                (ctx.file2 = {
                  rev: 2,
                  name: 'file2',
                  _id: 'file2_id',
                }),
              ],
              folders: [],
            }),
          ],
        },
      ]
      ctx.ProjectGetter.promises.getProjectWithoutDocLines = sinon
        .stub()
        .resolves(ctx.project)
    })

    describe('getAllDocs', function () {
      let fetchedDocs
      beforeEach(async function (ctx) {
        ctx.docs = [
          {
            _id: ctx.doc1._id,
            lines: (ctx.lines1 = ['one']),
            rev: (ctx.rev1 = 1),
          },
          {
            _id: ctx.doc2._id,
            lines: (ctx.lines2 = ['two']),
            rev: (ctx.rev2 = 2),
          },
        ]
        ctx.DocstoreManager.promises.getAllDocs = sinon
          .stub()
          .resolves(ctx.docs)
        fetchedDocs =
          await ctx.ProjectEntityHandler.promises.getAllDocs(projectId)
      })

      it('should get the doc lines and rev from the docstore', function (ctx) {
        ctx.DocstoreManager.promises.getAllDocs
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback with the docs with the lines and rev included', function (ctx) {
        expect(fetchedDocs).to.deep.equal({
          '/doc1': {
            _id: ctx.doc1._id,
            lines: ctx.lines1,
            name: ctx.doc1.name,
            rev: ctx.rev1,
            folder: ctx.project.rootFolder[0],
          },
          '/folder1/doc2': {
            _id: ctx.doc2._id,
            lines: ctx.lines2,
            name: ctx.doc2.name,
            rev: ctx.rev2,
            folder: ctx.folder1,
          },
        })
      })
    })

    describe('getAllFiles', function () {
      let allFiles
      beforeEach(async function (ctx) {
        ctx.callback = sinon.stub()
        allFiles = await ctx.ProjectEntityHandler.promises.getAllFiles(
          projectId,
          ctx.callback
        )
      })

      it('should call the callback with the files', function (ctx) {
        expect(allFiles).to.deep.equal({
          '/file1': { ...ctx.file1, folder: ctx.project.rootFolder[0] },
          '/folder1/file2': { ...ctx.file2, folder: ctx.folder1 },
        })
      })
    })

    describe('getAllDocPathsFromProject', function () {
      beforeEach(function (ctx) {
        ctx.docs = [
          {
            _id: ctx.doc1._id,
            lines: (ctx.lines1 = ['one']),
            rev: (ctx.rev1 = 1),
          },
          {
            _id: ctx.doc2._id,
            lines: (ctx.lines2 = ['two']),
            rev: (ctx.rev2 = 2),
          },
        ]
      })

      it('should call the callback with the path for each docId', function (ctx) {
        const expected = {
          [ctx.doc1._id]: `/${ctx.doc1.name}`,
          [ctx.doc2._id]: `/folder1/${ctx.doc2.name}`,
        }
        expect(
          ctx.ProjectEntityHandler.getAllDocPathsFromProject(
            ctx.project,
            ctx.callback
          )
        ).to.deep.equal(expected)
      })
    })

    describe('getDocPathByProjectIdAndDocId', function () {
      it('should call the callback with the path for an existing doc id at the root level', async function (ctx) {
        const path =
          await ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.doc1._id
          )
        expect(path).to.deep.equal(`/${ctx.doc1.name}`)
      })

      it('should call the callback with the path for an existing doc id nested within a folder', async function (ctx) {
        const path =
          await ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.doc2._id
          )
        expect(path).to.deep.equal(`/folder1/${ctx.doc2.name}`)
      })

      it('should call the callback with a NotFoundError for a non-existing doc', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            'non-existing-id'
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })

      it('should call the callback with a NotFoundError for an existing file', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.file1._id
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('_getAllFolders', async function () {
      let folders
      beforeEach(async function (ctx) {
        ctx.callback = sinon.stub()
        folders =
          await ctx.ProjectEntityHandler.promises._getAllFolders(projectId)
      })

      it('should get the project without the docs lines', function (ctx) {
        ctx.ProjectGetter.promises.getProjectWithoutDocLines
          .calledWith(projectId)
          .should.equal(true)
      })

      it('should call the callback with the folders', function (ctx) {
        expect(folders).to.deep.equal([
          { path: '/', folder: ctx.project.rootFolder[0] },
          { path: '/folder1', folder: ctx.folder1 },
        ])
      })
    })

    describe('_getAllFoldersFromProject', function () {
      it('should return the folders', function (ctx) {
        expect(
          ctx.ProjectEntityHandler._getAllFoldersFromProject(ctx.project)
        ).to.deep.equal([
          { path: '/', folder: ctx.project.rootFolder[0] },
          { path: '/folder1', folder: ctx.folder1 },
        ])
      })
    })
  })

  describe('with an invalid file tree', function () {
    beforeEach(function (ctx) {
      ctx.project.rootFolder = [
        {
          docs: [
            (ctx.doc1 = {
              name: null, // invalid doc name
              _id: 'doc1_id',
            }),
          ],
          fileRefs: [
            (ctx.file1 = {
              rev: 1,
              _id: 'file1_id',
              name: null, // invalid file name
            }),
          ],
          folders: [
            (ctx.folder1 = {
              name: null, // invalid folder name
              docs: [
                (ctx.doc2 = {
                  name: 'doc2',
                  _id: 'doc2_id',
                }),
              ],
              fileRefs: [
                (ctx.file2 = {
                  rev: 2,
                  name: 'file2',
                  _id: 'file2_id',
                }),
              ],
              folders: null,
            }),
            null, // invalid folder
          ],
        },
      ]
      ctx.ProjectGetter.promises.getProjectWithoutDocLines = sinon
        .stub()
        .resolves(ctx.project)
    })

    describe('getAllDocs', function () {
      beforeEach(async function (ctx) {
        ctx.docs = [
          {
            _id: ctx.doc1._id,
            lines: (ctx.lines1 = ['one']),
            rev: (ctx.rev1 = 1),
          },
          {
            _id: ctx.doc2._id,
            lines: (ctx.lines2 = ['two']),
            rev: (ctx.rev2 = 2),
          },
        ]
        ctx.DocstoreManager.promises.getAllDocs = sinon
          .stub()
          .resolves(ctx.docs)
      })

      it('should call the callback with an error', async function (ctx) {
        await expect(ctx.ProjectEntityHandler.promises.getAllDocs(projectId)).to
          .be.rejected
      })
    })

    describe('getAllFiles', function () {
      it('should call the callback with and error', async function (ctx) {
        await expect(ctx.ProjectEntityHandler.promises.getAllFiles(projectId))
          .to.be.rejected
      })
    })

    describe('getDocPathByProjectIdAndDocId', function () {
      it('should call the callback with an error for an existing doc id at the root level', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.doc1._id
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for an existing doc id nested within a folder', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.doc2._id
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for a non-existing doc', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            'non-existing-id'
          )
        ).to.be.rejectedWith(Error)
      })

      it('should call the callback with an error for an existing file', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathByProjectIdAndDocId(
            projectId,
            ctx.file1._id
          )
        ).to.be.rejectedWith(Error)
      })
    })

    describe('_getAllFolders', function () {
      it('should call the callback with an error', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises._getAllFolders(projectId)
        ).to.be.rejected
      })
    })

    describe('getAllEntities', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject = sinon
          .stub()
          .resolves(ctx.project)
      })

      it('should call the callback with an error', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getAllEntities(projectId)
        ).to.be.rejected
      })
    })

    describe('getAllDocPathsFromProjectById', function () {
      it('should call the callback with an error', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getAllDocPathsFromProjectById(
            projectId
          )
        ).to.be.rejected
      })
    })

    describe('getDocPathFromProjectByDocId', function () {
      it('should call the callback with an error', async function (ctx) {
        await expect(
          ctx.ProjectEntityHandler.promises.getDocPathFromProjectByDocId(
            projectId,
            ctx.doc1._id
          )
        ).to.be.rejected
      })
    })
  })

  describe('getDoc', function () {
    beforeEach(function (ctx) {
      ctx.lines = ['mock', 'doc', 'lines']
      ctx.rev = 5
      ctx.version = 42
      ctx.ranges = { mock: 'ranges' }
      ctx.callback = sinon.stub()
      ctx.DocstoreManager.promises.getDoc = sinon.stub().resolves({
        lines: ctx.lines,
        rev: ctx.rev,
        version: ctx.version,
        ranges: ctx.ranges,
      })
    })

    it('should call the callback with the lines, version and rev', async function (ctx) {
      const doc = await ctx.ProjectEntityHandler.promises.getDoc(
        projectId,
        docId
      )
      ctx.DocstoreManager.promises.getDoc
        .calledWith(projectId, docId)
        .should.equal(true)
      expect(doc).to.exist
    })
  })

  describe('promises.getDoc', function () {
    let result

    beforeEach(async function (ctx) {
      ctx.lines = ['mock', 'doc', 'lines']
      ctx.rev = 5
      ctx.version = 42
      ctx.ranges = { mock: 'ranges' }

      ctx.DocstoreManager.promises.getDoc = sinon.stub().resolves({
        lines: ctx.lines,
        rev: ctx.rev,
        version: ctx.version,
        ranges: ctx.ranges,
      })
      result = await ctx.ProjectEntityHandler.promises.getDoc(projectId, docId)
    })

    it('should call the docstore', function (ctx) {
      ctx.DocstoreManager.promises.getDoc
        .calledWith(projectId, docId)
        .should.equal(true)
    })

    it('should return the lines, rev, version and ranges', function (ctx) {
      expect(result.lines).to.equal(ctx.lines)
      expect(result.rev).to.equal(ctx.rev)
      expect(result.version).to.equal(ctx.version)
      expect(result.ranges).to.equal(ctx.ranges)
    })
  })
})
