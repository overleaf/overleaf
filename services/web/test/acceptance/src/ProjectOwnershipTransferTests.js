const { expect } = require('chai')
const User = require('./helpers/User').promises

describe('Project ownership transfer', function() {
  beforeEach(async function() {
    this.ownerSession = new User()
    this.collaboratorSession = new User()
    this.strangerSession = new User()
    this.adminSession = new User()
    await this.adminSession.ensureUserExists()
    await this.adminSession.ensureAdmin()
    await this.ownerSession.login()
    await this.collaboratorSession.login()
    await this.strangerSession.login()
    await this.adminSession.login()
    this.owner = await this.ownerSession.get()
    this.collaborator = await this.collaboratorSession.get()
    this.stranger = await this.strangerSession.get()
    this.admin = await this.adminSession.get()
    this.projectId = await this.ownerSession.createProject('Test project')
    await this.ownerSession.addUserToProject(
      this.projectId,
      this.collaborator,
      'readAndWrite'
    )
  })

  describe('happy path', function() {
    beforeEach(async function() {
      await this.ownerSession.transferProjectOwnership(
        this.projectId,
        this.collaborator._id
      )
    })

    it('changes the project owner', async function() {
      const project = await this.collaboratorSession.getProject(this.projectId)
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
    })

    it('adds the previous owner as a read/write collaborator', async function() {
      const project = await this.collaboratorSession.getProject(this.projectId)
      expect(project.collaberator_refs.map(x => x.toString())).to.have.members([
        this.owner._id.toString()
      ])
    })

    it('lets the new owner open the project', async function() {
      await this.collaboratorSession.openProject(this.projectId)
    })

    it('lets the previous owner open the project', async function() {
      await this.ownerSession.openProject(this.projectId)
    })
  })

  describe('validation', function() {
    it('lets only the project owner transfer ownership', async function() {
      await expect(
        this.collaboratorSession.transferProjectOwnership(
          this.projectId,
          this.collaborator._id
        )
      ).to.be.rejectedWith('Unexpected status code: 403')
    })

    it('prevents transfers to a non-collaborator', async function() {
      await expect(
        this.ownerSession.transferProjectOwnership(
          this.projectId,
          this.stranger._id
        )
      ).to.be.rejectedWith('Unexpected status code: 403')
    })

    it('allows an admin to transfer to any project to a non-collaborator', async function() {
      await expect(
        this.adminSession.transferProjectOwnership(
          this.projectId,
          this.stranger._id
        )
      ).to.be.fulfilled
    })
  })
})
