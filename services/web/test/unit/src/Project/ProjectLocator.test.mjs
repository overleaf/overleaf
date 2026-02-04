import { vi, expect } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const modulePath = '../../../../app/src/Features/Project/ProjectLocator'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const project = { _id: '1234566', rootFolder: [] }
const rootDoc = { name: 'rootDoc', _id: 'das239djd' }
const doc1 = { name: 'otherDoc.txt', _id: 'dsad2ddd' }
const doc2 = { name: 'docname.txt', _id: 'dsad2ddddd' }
const file1 = { name: 'file1', _id: 'dsa9lkdsad' }
const subSubFile = { name: 'subSubFile', _id: 'd1d2dk' }
const subSubDoc = { name: 'subdoc.txt', _id: '321dmdwi' }
const firstSubFolder = {
  name: 'firstSubFolder',
  _id: 'rweq43',
  docs: [],
  fileRefs: [],
  folders: [],
}
const secondSubFolder = {
  name: 'secondSubFolder',
  _id: 'dsa3e23',
  docs: [subSubDoc],
  fileRefs: [subSubFile],
  folders: [],
}
const subFolder = {
  name: 'subFolder',
  _id: 'dsadsa93',
  folders: [secondSubFolder, null],
  docs: [],
  fileRefs: [],
}
const subFolder1 = {
  name: 'subFolder1',
  _id: '123asdjoij',
  folders: [firstSubFolder],
}

const rootFolder = {
  _id: '123sdskd',
  docs: [doc1, doc2, null, rootDoc],
  fileRefs: [file1],
  folders: [subFolder1, subFolder],
}

project.rootFolder[0] = rootFolder
project.rootDoc_id = rootDoc._id

describe('ProjectLocator', function () {
  beforeEach(async function (ctx) {
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(project),
      },
    }
    ctx.ProjectHelper = {
      isArchived: sinon.stub(),
      isTrashed: sinon.stub(),
      isArchivedOrTrashed: sinon.stub(),
    }

    vi.doMock('../../../../app/src/models/User', () => ({
      default: { User: ctx.User },
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectHelper', () => ({
      default: ctx.ProjectHelper,
    }))

    ctx.locator = (await import(modulePath)).default
  })

  describe('finding a doc', function () {
    it('finds one at the root level', async function (ctx) {
      const { element, path, folder } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: doc2._id,
        type: 'docs',
      })
      element._id.should.equal(doc2._id)
      path.fileSystem.should.equal(`/${doc2.name}`)
      folder._id.should.equal(project.rootFolder[0]._id)
      path.mongo.should.equal('rootFolder.0.docs.1')
    })

    it('when it is nested', async function (ctx) {
      const { element, path, folder } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: subSubDoc._id,
        type: 'doc',
      })
      expect(element._id).to.equal(subSubDoc._id)
      path.fileSystem.should.equal(
        `/${subFolder.name}/${secondSubFolder.name}/${subSubDoc.name}`
      )
      folder._id.should.equal(secondSubFolder._id)
      path.mongo.should.equal('rootFolder.0.folders.1.folders.0.docs.0')
    })

    it('should give error if element could not be found', async function (ctx) {
      await expect(
        ctx.locator.promises.findElement({
          project_id: project._id,
          element_id: 'ddsd432nj42',
          type: 'docs',
        })
      )
        .to.eventually.be.rejectedWith(Errors.NotFoundError)
        .and.eventually.have.property('message', 'entity not found')
    })
  })

  describe('finding a folder', function () {
    it('should return root folder when looking for root folder', async function (ctx) {
      const { element: foundElement } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: rootFolder._id,
        type: 'folder',
      })
      foundElement._id.should.equal(rootFolder._id)
    })

    it('should not return root folder when searching for docs', async function (ctx) {
      await expect(
        ctx.locator.promises.findElement({
          project_id: project._id,
          element_id: rootFolder._id,
          type: 'docs',
        })
      )
        .to.eventually.be.rejectedWith(Errors.NotFoundError)
        .and.eventually.have.property('message', 'entity not found')
    })

    it('should not return root folder when searching for files', async function (ctx) {
      await expect(
        ctx.locator.promises.findElement({
          project_id: project._id,
          element_id: rootFolder._id,
          type: 'files',
        })
      )
        .to.eventually.be.rejectedWith(Errors.NotFoundError)
        .and.eventually.have.property('message', 'entity not found')
    })

    it('when at root', async function (ctx) {
      const {
        element: foundElement,
        path,
        folder: parentFolder,
      } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: subFolder._id,
        type: 'folder',
      })
      foundElement._id.should.equal(subFolder._id)
      path.fileSystem.should.equal(`/${subFolder.name}`)
      parentFolder._id.should.equal(rootFolder._id)
      path.mongo.should.equal('rootFolder.0.folders.1')
    })

    it('when deeply nested', async function (ctx) {
      const {
        element: foundElement,
        path,
        folder: parentFolder,
      } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: secondSubFolder._id,
        type: 'folder',
      })

      foundElement._id.should.equal(secondSubFolder._id)
      path.fileSystem.should.equal(`/${subFolder.name}/${secondSubFolder.name}`)
      parentFolder._id.should.equal(subFolder._id)
      path.mongo.should.equal('rootFolder.0.folders.1.folders.0')
    })
  })

  describe('finding a file', function () {
    it('when at root', async function (ctx) {
      const {
        element: foundElement,
        path,
        folder: parentFolder,
      } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: file1._id,
        type: 'fileRefs',
      })
      foundElement._id.should.equal(file1._id)
      path.fileSystem.should.equal(`/${file1.name}`)
      parentFolder._id.should.equal(rootFolder._id)
      path.mongo.should.equal('rootFolder.0.fileRefs.0')
    })

    it('when deeply nested', async function (ctx) {
      const {
        element: foundElement,
        path,
        folder: parentFolder,
      } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: subSubFile._id,
        type: 'fileRefs',
      })
      foundElement._id.should.equal(subSubFile._id)
      path.fileSystem.should.equal(
        `/${subFolder.name}/${secondSubFolder.name}/${subSubFile.name}`
      )
      parentFolder._id.should.equal(secondSubFolder._id)
      path.mongo.should.equal('rootFolder.0.folders.1.folders.0.fileRefs.0')
    })
  })

  describe('finding an element with wrong element type', function () {
    it('should add an s onto the element type', async function (ctx) {
      const { element: foundElement } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: subSubDoc._id,
        type: 'doc',
      })
      foundElement._id.should.equal(subSubDoc._id)
    })

    it('should convert file to fileRefs', async function (ctx) {
      const { element: foundElement } = await ctx.locator.promises.findElement({
        project_id: project._id,
        element_id: file1._id,
        type: 'fileRefs',
      })
      foundElement._id.should.equal(file1._id)
    })
  })

  describe('should be able to take actual project as well as id', function () {
    const doc3 = {
      _id: '123dsdj3',
      name: 'doc3',
    }
    const rootFolder2 = {
      _id: '123sddedskd',
      docs: [doc3],
    }
    const project2 = {
      _id: '1234566',
      rootFolder: [rootFolder2],
    }
    it('should find doc in project', async function (ctx) {
      const {
        element: foundElement,
        path,
        folder: parentFolder,
      } = await ctx.locator.promises.findElement({
        project: project2,
        element_id: doc3._id,
        type: 'docs',
      })
      foundElement._id.should.equal(doc3._id)
      path.fileSystem.should.equal(`/${doc3.name}`)
      parentFolder._id.should.equal(project2.rootFolder[0]._id)
      path.mongo.should.equal('rootFolder.0.docs.0')
    })
  })

  describe('finding root doc', function () {
    it('should return root doc when passed project', async function (ctx) {
      const { element: doc } = await ctx.locator.promises.findRootDoc(project)
      doc._id.should.equal(rootDoc._id)
    })

    it('should return root doc when passed project_id', async function (ctx) {
      const { element: doc } = await ctx.locator.promises.findRootDoc(
        project._id
      )
      doc._id.should.equal(rootDoc._id)
    })

    it('should return null when the project has no rootDoc', async function (ctx) {
      project.rootDoc_id = null
      const { element: rootDoc } =
        await ctx.locator.promises.findRootDoc(project)
      expect(rootDoc).to.equal(null)
    })

    it('should return null when the rootDoc_id no longer exists', async function (ctx) {
      project.rootDoc_id = 'doesntexist'
      const { element: rootDoc } =
        await ctx.locator.promises.findRootDoc(project)
      expect(rootDoc).to.equal(null)
    })
  })

  describe('findElementByPath', function () {
    it('should take a doc path and return the element for a root level document', async function (ctx) {
      const path = `${doc1.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(doc1)
      expect(type).to.equal('doc')
      expect(folder).to.equal(rootFolder)
    })

    it('should take a doc path and return the element for a root level document with a starting slash', async function (ctx) {
      const path = `/${doc1.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(doc1)
      expect(type).to.equal('doc')
      expect(folder).to.equal(rootFolder)
    })

    it('should take a doc path and return the element for a nested document', async function (ctx) {
      const path = `${subFolder.name}/${secondSubFolder.name}/${subSubDoc.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(subSubDoc)
      expect(type).to.equal('doc')
      expect(folder).to.equal(secondSubFolder)
    })

    it('should take a file path and return the element for a root level document', async function (ctx) {
      const path = `${file1.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(file1)
      expect(type).to.equal('file')
      expect(folder).to.equal(rootFolder)
    })

    it('should take a file path and return the element for a nested document', async function (ctx) {
      const path = `${subFolder.name}/${secondSubFolder.name}/${subSubFile.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(subSubFile)
      expect(type).to.equal('file')
      expect(folder).to.equal(secondSubFolder)
    })

    it('should take a file path and return the element for a nested document case insenstive', async function (ctx) {
      const path = `${subFolder.name.toUpperCase()}/${secondSubFolder.name.toUpperCase()}/${subSubFile.name.toUpperCase()}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(subSubFile)
      expect(type).to.equal('file')
      expect(folder).to.equal(secondSubFolder)
    })

    it('should not return elements with a case-insensitive match when exactCaseMatch is true', async function (ctx) {
      const path = `${subFolder.name.toUpperCase()}/${secondSubFolder.name.toUpperCase()}/${subSubFile.name.toUpperCase()}`
      await expect(
        ctx.locator.promises.findElementByPath({
          project,
          path,
          exactCaseMatch: true,
        })
      ).to.eventually.be.rejected
    })

    it('should take a file path and return the element for a nested folder', async function (ctx) {
      const path = `${subFolder.name}/${secondSubFolder.name}`
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(secondSubFolder)
      expect(type).to.equal('folder')
      expect(folder).to.equal(subFolder)
    })

    it('should take a file path and return the root folder', async function (ctx) {
      const path = '/'
      const { element, type, folder } =
        await ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      element.should.deep.equal(rootFolder)
      expect(type).to.equal('folder')
      expect(folder).to.equal(null)
    })

    it('should return an error if the file can not be found inside know folder', async function (ctx) {
      const path = `${subFolder.name}/${secondSubFolder.name}/exist.txt`
      await expect(ctx.locator.promises.findElementByPath({ project, path })).to
        .eventually.be.rejected
    })

    it('should return an error if the file can not be found inside unknown folder', async function (ctx) {
      const path = 'this/does/not/exist.txt'
      await expect(
        ctx.locator.promises.findElementByPath({
          project,
          path,
        })
      ).to.eventually.be.rejected
    })

    describe('where duplicate folder exists', function () {
      beforeEach(function (ctx) {
        ctx.duplicateFolder = {
          name: 'duplicate1',
          _id: '1234',
          folders: [
            {
              name: '1',
              docs: [{ name: 'main.tex', _id: '456' }],
              folders: [],
              fileRefs: [],
            },
          ],
          docs: [(ctx.doc = { name: 'main.tex', _id: '456' })],
          fileRefs: [],
        }
        ctx.project = {
          rootFolder: [
            {
              folders: [ctx.duplicateFolder, ctx.duplicateFolder],
              fileRefs: [],
              docs: [],
            },
          ],
        }
      })

      it('should not call the callback more than once', async function (ctx) {
        const path = `${ctx.duplicateFolder.name}/${ctx.doc.name}`
        await ctx.locator.promises.findElementByPath({
          project: ctx.project,
          path,
        })
      }) // mocha will throw exception if done called multiple times

      it('should not call the callback more than once when the path is longer than 1 level below the duplicate level', async function (ctx) {
        const path = `${ctx.duplicateFolder.name}/1/main.tex`
        await ctx.locator.promises.findElementByPath({
          project: ctx.project,
          path,
        })
      })
    }) // mocha will throw exception if done called multiple times

    describe('with a null doc', function () {
      beforeEach(function (ctx) {
        ctx.project = {
          rootFolder: [
            {
              folders: [],
              fileRefs: [],
              docs: [{ name: 'main.tex' }, null, { name: 'other.tex' }],
            },
          ],
        }
      })

      it('should not crash with a null', async function (ctx) {
        const path = '/other.tex'
        const { element } = await ctx.locator.promises.findElementByPath({
          project: ctx.project,
          path,
        })
        element.name.should.equal('other.tex')
      })
    })

    describe('with a null project', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter = {
          promises: {
            getProject: sinon.stub().resolves(null),
          },
        }
      })

      it('should not crash with a null', async function (ctx) {
        const path = '/other.tex'
        await expect(
          ctx.locator.promises.findElementByPath({
            project_id: project._id,
            path,
          })
        ).to.be.rejected
      })
    })

    describe('with a project_id', function () {
      it('should take a doc path and return the element for a root level document', async function (ctx) {
        const path = `${doc1.name}`
        const { element, type } = await ctx.locator.promises.findElementByPath({
          project_id: project._id,
          path,
        })
        ctx.ProjectGetter.promises.getProject
          .calledWith(project._id, { rootFolder: true, rootDoc_id: true })
          .should.equal(true)
        element.should.deep.equal(doc1)
        expect(type).to.equal('doc')
      })
    })
  })

  describe('findElementByMongoPath', function () {
    it('traverses the file tree like Mongo would do', function (ctx) {
      const element = ctx.locator.findElementByMongoPath(
        project,
        'rootFolder.0.folders.1.folders.0.fileRefs.0'
      )
      expect(element).to.equal(subSubFile)
    })

    it('throws an error if no element is found', function (ctx) {
      expect(() =>
        ctx.locator.findElementByMongoPath(
          project,
          'rootolder.0.folders.0.folders.0.fileRefs.0'
        )
      ).to.throw
    })
  })
})
