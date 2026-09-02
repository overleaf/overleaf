import User from './helpers/User.mjs'
import { expect } from 'chai'
import settings from '@overleaf/settings'
import { expectValidationErrorRaw } from '@overleaf/validation-tools/testUtils.js'

const UserPromises = User.promises

describe('EditorHttpController', function () {
  beforeEach('login', function (done) {
    this.user = new User()
    this.user.login(done)
  })
  beforeEach('create project', function (done) {
    this.projectName = 'wombat'
    this.user.createProject(this.projectName, (error, projectId) => {
      if (error) return done(error)
      this.projectId = projectId
      done()
    })
  })
  describe('joinProject', function () {
    it('returns project details', function (done) {
      this.user.joinProject(this.projectId, (error, details) => {
        if (error) return done(error)

        expect(details.project.name).to.equal(this.projectName)
        done()
      })
    })
  })
})

describe('EditorHttpController validation', function () {
  let owner, projectId, rootFolderId

  beforeEach(async function () {
    owner = new UserPromises()
    await owner.login()
    projectId = await owner.createProject('editor-http-controller-test', {
      template: 'blank',
    })
    const project = await owner.getProject(projectId)
    rootFolderId = project.rootFolder[0]._id.toString()
  })

  describe('POST /project/:Project_id/doc', function () {
    it('should add a doc', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/doc`,
        json: { name: 'another.tex', parent_folder_id: rootFolderId },
      })
      expect(response.statusCode).to.equal(200)
      expect(body.name).to.equal('another.tex')
    })

    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/not-an-object-id/doc',
        json: { name: 'another.tex', parent_folder_id: rootFolderId },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('POST /project/:Project_id/folder', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: '/project/not-an-object-id/folder',
        json: { name: 'a-folder', parent_folder_id: rootFolderId },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('POST /project/:Project_id/:entity_type/:entity_id/rename', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/not-an-object-id/doc/${projectId}/rename`,
        json: { name: 'renamed.tex' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })

    it('should reject an invalid entity_type with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/not-a-type/${projectId}/rename`,
        json: { name: 'renamed.tex' },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'entity_type'
      )
    })
  })

  describe('POST /project/:Project_id/:entity_type/:entity_id/move', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/not-an-object-id/doc/${projectId}/move`,
        json: { folder_id: projectId },
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('DELETE /project/:Project_id/doc/:entity_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('delete', {
        url: `/project/not-an-object-id/doc/${projectId}`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('DELETE /project/:Project_id/file/:entity_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('delete', {
        url: `/project/not-an-object-id/file/${projectId}`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('DELETE /project/:Project_id/folder/:entity_id', function () {
    it('should reject a malformed project id with 404', async function () {
      const { response, body } = await owner.doRequest('delete', {
        url: `/project/not-an-object-id/folder/${projectId}`,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        404,
        'Project_id'
      )
    })
  })

  describe('POST /project/:Project_id/join', function () {
    it('should reject a userId that is neither an ObjectId nor "anonymous-user" with 400', async function () {
      const { response, body } = await owner.doRequest('post', {
        url: `/project/${projectId}/join`,
        auth: {
          user: settings.apis.web.user,
          pass: settings.apis.web.pass,
          sendImmediately: true,
        },
        json: { userId: 'not-a-valid-user-id' },
        jar: false,
      })
      expectValidationErrorRaw(
        { statusCode: response.statusCode, body },
        400,
        'userId'
      )
    })
  })
})
