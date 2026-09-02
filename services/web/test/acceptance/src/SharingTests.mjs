import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'

const User = UserHelper.promises

describe('Sharing', function () {
  beforeEach(async function () {
    this.ownerSession = new User()
    this.collaboratorSession = new User()
    this.strangerSession = new User()
    this.reviewerSession = new User()
    await this.ownerSession.login()
    await this.collaboratorSession.login()
    await this.strangerSession.login()
    await this.reviewerSession.login()
    this.owner = await this.ownerSession.get()
    this.collaborator = await this.collaboratorSession.get()
    this.stranger = await this.strangerSession.get()
    this.reviewer = await this.reviewerSession.get()
    this.projectId = await this.ownerSession.createProject('Test project')
  })

  describe('with read-only collaborator', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readOnly'
      )
    })

    it('sets the privilege level to read-write', async function () {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readAndWrite' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([this.collaborator._id])
      expect(project.readOnly_refs).to.deep.equal([])
      expect(project.reviewer_refs).to.deep.equal([])
    })

    it('sets the privilege level to review', async function () {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'review' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.reviewer_refs).to.deep.equal([this.collaborator._id])
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.deep.equal([])
    })

    it('treats setting the privilege to read-only as a noop', async function () {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readOnly' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.reviewer_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.deep.equal([this.collaborator._id])
    })

    it('prevents non-owners to set the privilege level', async function () {
      await expect(
        this.collaboratorSession.setCollaboratorInfo(
          this.projectId,
          this.collaborator._id,
          { privilegeLevel: 'readAndWrite' }
        )
      ).to.be.rejectedWith(/failed: status=403 /)
    })

    it('validates the privilege level', async function () {
      await expect(
        this.ownerSession.setCollaboratorInfo(
          this.projectId,
          this.collaborator._id,
          { privilegeLevel: 'superpowers' }
        )
      ).to.be.rejectedWith(/failed: status=400 /)
    })

    it('returns 404 if the user is not already a collaborator', async function () {
      await expect(
        this.ownerSession.setCollaboratorInfo(
          this.projectId,
          this.stranger._id,
          { privilegeLevel: 'readOnly' }
        )
      ).to.be.rejectedWith(/failed: status=404 /)
    })
  })

  describe('with read-write collaborator', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
    })

    it('sets the privilege level to read-only', async function () {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readOnly' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.reviewer_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.deep.equal([this.collaborator._id])
    })
  })

  describe('with reviewer collaborator', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.reviewer,
        'review'
      )
    })

    it('prevents non-owners to set the privilege level', async function () {
      await expect(
        this.collaboratorSession.setCollaboratorInfo(
          this.projectId,
          this.reviewer._id,
          { privilegeLevel: 'review' }
        )
      ).to.be.rejectedWith(/failed: status=403 /)
    })

    it('sets the privilege level to read-only', async function () {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.reviewer._id,
        { privilegeLevel: 'readOnly' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.reviewer_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.deep.equal([this.reviewer._id])
    })
  })

  describe('validation', function () {
    it('rejects an unrecognized field in the body when setting collaborator info', async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readOnly'
      )
      await expect(
        this.ownerSession.setCollaboratorInfo(
          this.projectId,
          this.collaborator._id,
          { privilegeLevel: 'readOnly', notARealField: 'nope' }
        )
      ).to.be.rejectedWith(/failed: status=400 /)
    })

    it('rejects an unrecognized field in the body when transferring ownership', async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
      const { response } = await this.ownerSession.doRequest('POST', {
        url: `/project/${this.projectId}/transfer-ownership`,
        json: {
          user_id: this.collaborator._id.toString(),
          notARealField: 'nope',
        },
      })
      expect(response.statusCode).to.equal(400)
    })
  })

  describe('removing a collaborator', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
    })

    it('lets the owner remove a collaborator', async function () {
      const { response } = await this.ownerSession.doRequest('DELETE', {
        url: `/project/${this.projectId}/users/${this.collaborator._id}`,
      })
      expect(response.statusCode).to.equal(204)
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
    })

    it('prevents non-owners from removing a collaborator', async function () {
      const { response } = await this.collaboratorSession.doRequest('DELETE', {
        url: `/project/${this.projectId}/users/${this.collaborator._id}`,
      })
      expect(response.statusCode).to.equal(403)
    })
  })

  describe('leaving a project', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
    })

    it('lets a collaborator leave the project', async function () {
      const { response } = await this.collaboratorSession.doRequest('POST', {
        url: `/project/${this.projectId}/leave`,
      })
      expect(response.statusCode).to.equal(204)
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
    })

    it('rejects a malformed project id', async function () {
      const { response } = await this.collaboratorSession.doRequest('POST', {
        url: '/project/not-a-valid-project-id/leave',
      })
      expect(response.statusCode).to.equal(404)
    })
  })

  describe('listing project members', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
    })

    it('lists invited members for a collaborator', async function () {
      const { response, body } = await this.collaboratorSession.doRequest(
        'GET',
        { url: `/project/${this.projectId}/members`, json: true }
      )
      expect(response.statusCode).to.equal(200)
      expect(body.members.map(member => member._id.toString())).to.have.members(
        [this.collaborator._id.toString()]
      )
    })
  })

  describe('access requests', function () {
    beforeEach(async function () {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.stranger,
        'readOnly'
      )
    })

    it('lets a viewer request edit access, visible to the owner', async function () {
      const requested = await this.strangerSession.doRequest('POST', {
        url: `/project/${this.projectId}/request-access`,
        json: { privilegeLevel: 'readAndWrite' },
      })
      expect(requested.response.statusCode).to.equal(204)

      const { response, body } = await this.ownerSession.doRequest('GET', {
        url: `/project/${this.projectId}/access-requests`,
        json: true,
      })
      expect(response.statusCode).to.equal(200)
      expect(
        body.editAccessRequests.map(request => request._id.toString())
      ).to.have.members([this.stranger._id.toString()])
    })

    it('prevents non-owners from listing access requests', async function () {
      const { response } = await this.collaboratorSession.doRequest('GET', {
        url: `/project/${this.projectId}/access-requests`,
        json: true,
      })
      expect(response.statusCode).to.equal(403)
    })

    it('lets the owner grant a pending access request', async function () {
      await this.strangerSession.doRequest('POST', {
        url: `/project/${this.projectId}/request-access`,
        json: { privilegeLevel: 'readAndWrite' },
      })
      const { response } = await this.ownerSession.doRequest('POST', {
        url: `/project/${this.projectId}/access-requests/${this.stranger._id}/grant`,
        json: { privilegeLevel: 'readAndWrite' },
      })
      expect(response.statusCode).to.equal(204)
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs.map(id => id.toString())).to.include(
        this.stranger._id.toString()
      )
    })

    it('lets the owner decline a pending access request', async function () {
      await this.strangerSession.doRequest('POST', {
        url: `/project/${this.projectId}/request-access`,
        json: { privilegeLevel: 'readAndWrite' },
      })
      const declined = await this.ownerSession.doRequest('DELETE', {
        url: `/project/${this.projectId}/access-requests/${this.stranger._id}`,
      })
      expect(declined.response.statusCode).to.equal(204)

      const { body } = await this.ownerSession.doRequest('GET', {
        url: `/project/${this.projectId}/access-requests`,
        json: true,
      })
      expect(body.editAccessRequests).to.deep.equal([])
    })

    it('rejects a malformed user id when declining an access request', async function () {
      const { response } = await this.ownerSession.doRequest('DELETE', {
        url: `/project/${this.projectId}/access-requests/not-a-valid-user-id`,
      })
      expect(response.statusCode).to.equal(404)
    })

    it('rejects a malformed user id when granting an access request', async function () {
      const { response } = await this.ownerSession.doRequest('POST', {
        url: `/project/${this.projectId}/access-requests/not-a-valid-user-id/grant`,
        json: { privilegeLevel: 'readAndWrite' },
      })
      expect(response.statusCode).to.equal(404)
    })
  })
})
