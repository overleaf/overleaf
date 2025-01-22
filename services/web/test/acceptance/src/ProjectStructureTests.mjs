import chai, { expect } from 'chai'
import mongodb from 'mongodb-legacy'
import Path from 'node:path'
import fs from 'node:fs'
import { Project } from '../../../app/src/models/Project.js'
import ProjectGetter from '../../../app/src/Features/Project/ProjectGetter.js'
import UserHelper from './helpers/User.mjs'
import MockDocStoreApiClass from './mocks/MockDocstoreApi.mjs'
import MockDocUpdaterApiClass from './mocks/MockDocUpdaterApi.mjs'
import chaiAsPromised from 'chai-as-promised'

chai.use(chaiAsPromised)

const User = UserHelper.promises

const ObjectId = mongodb.ObjectId

let MockDocStoreApi, MockDocUpdaterApi

before(function () {
  MockDocUpdaterApi = MockDocUpdaterApiClass.instance()
  MockDocStoreApi = MockDocStoreApiClass.instance()
})

describe('ProjectStructureChanges', function () {
  let owner

  beforeEach(async function () {
    owner = new User()
    await owner.login()
  })

  async function createExampleProject(owner) {
    const projectId = await owner.createProject('example-project', {
      template: 'example',
    })

    const project = await ProjectGetter.promises.getProject(projectId)

    const rootFolderId = project.rootFolder[0]._id.toString()
    return { projectId, rootFolderId }
  }

  async function createExampleDoc(owner, projectId) {
    const project = await ProjectGetter.promises.getProject(projectId)

    const { response, body } = await owner.doRequest('POST', {
      uri: `project/${projectId}/doc`,
      json: {
        name: 'new.tex',
        parent_folder_id: project.rootFolder[0]._id,
      },
    })

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`failed to add doc ${response.statusCode}`)
    }

    return body._id
  }

  async function createExampleFolder(owner, projectId) {
    const { response, body } = await owner.doRequest('POST', {
      uri: `project/${projectId}/folder`,
      json: {
        name: 'foo',
      },
    })

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error(`failed to add doc ${response.statusCode}`)
    }

    return body._id
  }

  async function uploadExampleProject(owner, zipFilename, options = {}) {
    const zipFile = fs.createReadStream(
      Path.resolve(Path.join(import.meta.dirname, '..', 'files', zipFilename))
    )

    const { response, body } = await owner.doRequest('POST', {
      uri: 'project/new/upload',
      formData: {
        name: zipFilename,
        qqfile: zipFile,
      },
    })

    if (
      !options.allowBadStatus &&
      (response.statusCode < 200 || response.statusCode >= 300)
    ) {
      throw new Error(`failed to upload project ${response.statusCode}`)
    }

    return { projectId: JSON.parse(body).project_id, response }
  }

  async function deleteItem(owner, projectId, type, itemId) {
    return await owner.deleteItemInProject(projectId, type, itemId)
  }

  describe('uploading a project with a name', function () {
    let exampleProjectId
    const testProjectName = 'wombat'

    beforeEach(async function () {
      const { projectId } = await uploadExampleProject(
        owner,
        'test_project_with_name.zip'
      )
      exampleProjectId = projectId
    })

    it('should set the project name from the zip contents', async function () {
      const project = await ProjectGetter.promises.getProject(exampleProjectId)
      expect(project.name).to.equal(testProjectName)
    })
  })

  describe('uploading a project with an invalid name', function () {
    let exampleProjectId
    const testProjectMatch = /^bad[^\\]+name$/

    beforeEach(async function () {
      const { projectId } = await uploadExampleProject(
        owner,
        'test_project_with_invalid_name.zip'
      )

      exampleProjectId = projectId
    })

    it('should set the project name from the zip contents', async function () {
      const project = await ProjectGetter.promises.getProject(exampleProjectId)
      expect(project.name).to.match(testProjectMatch)
    })
  })

  describe('uploading an empty zipfile', function () {
    let res

    beforeEach(async function () {
      const { response } = await uploadExampleProject(
        owner,
        'test_project_empty.zip',
        { allowBadStatus: true }
      )
      res = response
    })

    it('should fail with 422 error', function () {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a zipfile containing only empty directories', function () {
    let res

    beforeEach(async function () {
      const { response } = await uploadExampleProject(
        owner,
        'test_project_with_empty_folder.zip',
        { allowBadStatus: true }
      )

      res = response
    })

    it('should fail with 422 error', function () {
      expect(res.statusCode).to.equal(422)
    })
  })

  describe('uploading a project with a shared top-level folder', function () {
    let exampleProjectId

    beforeEach(async function () {
      const { projectId } = await uploadExampleProject(
        owner,
        'test_project_with_shared_top_level_folder.zip'
      )
      exampleProjectId = projectId
    })

    it('should not create the top-level folder', async function () {
      const project = await ProjectGetter.promises.getProject(exampleProjectId)
      expect(project.rootFolder[0].folders.length).to.equal(0)
      expect(project.rootFolder[0].docs.length).to.equal(2)
    })
  })

  describe('uploading a project with backslashes in the path names', function () {
    let exampleProjectId

    beforeEach(async function () {
      const { projectId } = await uploadExampleProject(
        owner,
        'test_project_with_backslash_in_filename.zip'
      )
      exampleProjectId = projectId
    })

    it('should treat the backslash as a directory separator', async function () {
      const project = await ProjectGetter.promises.getProject(exampleProjectId)
      expect(project.rootFolder[0].folders[0].name).to.equal('styles')
      expect(project.rootFolder[0].folders[0].docs[0].name).to.equal('ao.sty')
    })
  })

  describe('deleting folders', function () {
    beforeEach(async function () {
      const { projectId } = await createExampleProject(owner)
      this.exampleProjectId = projectId
    })
    describe('when the folder is the rootFolder', function () {
      beforeEach(async function () {
        const project = await ProjectGetter.promises.getProject(
          this.exampleProjectId
        )
        this.rootFolderId = project.rootFolder[0]._id
      })

      it('should fail with a 422 error', async function () {
        await expect(
          deleteItem(owner, this.exampleProjectId, 'folder', this.rootFolderId)
        )
          .to.be.rejected.and.eventually.match(/status=422/)
          .and.eventually.match(/body="cannot delete root folder"/)
      })
    })

    describe('when the folder is not the rootFolder', function () {
      beforeEach(async function () {
        const folderId = await createExampleFolder(owner, this.exampleProjectId)
        this.exampleFolderId = folderId
      })

      it('should succeed', async function () {
        await expect(
          deleteItem(
            owner,
            this.exampleProjectId,
            'folder',
            this.exampleFolderId
          )
        ).to.be.fulfilled
      })
    })
  })

  describe('deleting docs', function () {
    beforeEach(async function () {
      const { projectId } = await createExampleProject(owner)
      this.exampleProjectId = projectId

      const folderId = await createExampleFolder(owner, projectId)
      this.exampleFolderId = folderId

      const docId = await createExampleDoc(owner, projectId)
      this.exampleDocId = docId

      MockDocUpdaterApi.reset()

      const project = await ProjectGetter.promises.getProject(
        this.exampleProjectId
      )
      this.project0 = project
    })

    it('should pass the doc name to docstore', async function () {
      await deleteItem(owner, this.exampleProjectId, 'doc', this.exampleDocId)

      expect(
        MockDocStoreApi.getDeletedDocs(this.exampleProjectId)
      ).to.deep.equal([{ _id: this.exampleDocId, name: 'new.tex' }])
    })

    describe('when rootDoc_id matches doc being deleted', function () {
      beforeEach(async function () {
        await Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleDocId } }
        ).exec()
      })

      it('should clear rootDoc_id', async function () {
        await deleteItem(owner, this.exampleProjectId, 'doc', this.exampleDocId)
        const project = ProjectGetter.promises.getProject(this.exampleProjectId)
        expect(project.rootDoc_id).to.be.undefined
      })
    })

    describe('when rootDoc_id does not match doc being deleted', function () {
      beforeEach(async function () {
        this.exampleRootDocId = new ObjectId()
        await Project.updateOne(
          { _id: this.exampleProjectId },
          { $set: { rootDoc_id: this.exampleRootDocId } }
        ).exec()
      })

      it('should not clear rootDoc_id', async function () {
        await deleteItem(owner, this.exampleProjectId, 'doc', this.exampleDocId)

        const project = await ProjectGetter.promises.getProject(
          this.exampleProjectId
        )

        expect(project.rootDoc_id.toString()).to.equal(
          this.exampleRootDocId.toString()
        )
      })
    })
  })
})
