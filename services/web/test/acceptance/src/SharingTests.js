const { expect } = require('chai')
const User = require('./helpers/User').promises

describe('Sharing', function() {
  beforeEach(async function() {
    this.ownerSession = new User()
    this.collaboratorSession = new User()
    this.strangerSession = new User()
    await this.ownerSession.login()
    await this.collaboratorSession.login()
    await this.strangerSession.login()
    this.owner = await this.ownerSession.get()
    this.collaborator = await this.collaboratorSession.get()
    this.stranger = await this.strangerSession.get()
    this.projectId = await this.ownerSession.createProject('Test project')
  })

  describe('with read-only collaborator', function() {
    beforeEach(async function() {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readOnly'
      )
    })

    it('sets the privilege level to read-write', async function() {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readAndWrite' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.be.unordered.ids([
        this.collaborator._id
      ])
      expect(project.readOnly_refs).to.deep.equal([])
    })

    it('treats setting the privilege to read-only as a noop', async function() {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readOnly' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.be.unordered.ids([this.collaborator._id])
    })

    it('prevents non-owners to set the privilege level', async function() {
      await expect(
        this.collaboratorSession.setCollaboratorInfo(
          this.projectId,
          this.collaborator._id,
          { privilegeLevel: 'readAndWrite' }
        )
      ).to.be.rejectedWith('Unexpected status code: 403')
    })

    it('validates the privilege level', async function() {
      await expect(
        this.collaboratorSession.setCollaboratorInfo(
          this.projectId,
          this.collaborator._id,
          { privilegeLevel: 'superpowers' }
        )
      ).to.be.rejectedWith('Unexpected status code: 400')
    })

    it('returns 404 if the user is not already a collaborator', async function() {
      await expect(
        this.ownerSession.setCollaboratorInfo(
          this.projectId,
          this.stranger._id,
          { privilegeLevel: 'readOnly' }
        )
      ).to.be.rejectedWith('Unexpected status code: 404')
    })
  })

  describe('with read-write collaborator', function() {
    beforeEach(async function() {
      await this.ownerSession.addUserToProject(
        this.projectId,
        this.collaborator,
        'readAndWrite'
      )
    })

    it('sets the privilege level to read-only', async function() {
      await this.ownerSession.setCollaboratorInfo(
        this.projectId,
        this.collaborator._id,
        { privilegeLevel: 'readOnly' }
      )
      const project = await this.ownerSession.getProject(this.projectId)
      expect(project.collaberator_refs).to.deep.equal([])
      expect(project.readOnly_refs).to.be.unordered.ids([this.collaborator._id])
    })
  })
})
