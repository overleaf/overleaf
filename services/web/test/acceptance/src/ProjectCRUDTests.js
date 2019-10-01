const { expect } = require('chai')
const User = require('./helpers/User').promises
const { Project } = require('../../../app/src/models/Project')

describe('Project CRUD', function() {
  beforeEach(async function() {
    this.user = new User()
    await this.user.login()

    this.projectId = await this.user.createProject('example-project')
  })

  describe("when project doesn't exist", function() {
    it('should return 404', async function() {
      const { response } = await this.user.doRequest(
        'GET',
        '/project/aaaaaaaaaaaaaaaaaaaaaaaa'
      )
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('when project has malformed id', function() {
    it('should return 404', async function() {
      const { response } = await this.user.doRequest('GET', '/project/blah')
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('when trashing a project', function() {
    it('should mark the project as trashed for the user', async function() {
      const { response } = await this.user.doRequest(
        'POST',
        `/project/${this.projectId}/trash`
      )
      expect(response.statusCode).to.equal(200)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [this.user._id])
    })

    it('does nothing if the user has already trashed the project', async function() {
      // Mark as trashed the first time
      await this.user.doRequest('POST', `/project/${this.projectId}/trash`)

      // And then a second time
      await this.user.doRequest('POST', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [this.user._id])
    })
  })

  describe('when untrashing a project', function() {
    it('should mark the project as untrashed for the user', async function() {
      await Project.update(
        { _id: this.projectId },
        { trashed: [this.user._id] }
      )
      const { response } = await this.user.doRequest(
        'DELETE',
        `/project/${this.projectId}/trash`
      )
      expect(response.statusCode).to.equal(200)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })

    it('does nothing if the user has already untrashed the project', async function() {
      await Project.update(
        { _id: this.projectId },
        { trashed: [this.user._id] }
      )
      // Mark as untrashed the first time
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      // And then a second time
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })

    it('sets trashed to an empty array if not set', async function() {
      await this.user.doRequest('DELETE', `/project/${this.projectId}/trash`)

      const trashedProject = await Project.findById(this.projectId).exec()
      expectObjectIdArrayEqual(trashedProject.trashed, [])
    })
  })
})

function expectObjectIdArrayEqual(objectIdArray, stringArray) {
  const stringifiedArray = objectIdArray.map(id => id.toString())
  expect(stringifiedArray).to.deep.equal(stringArray)
}
