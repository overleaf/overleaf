import { expect } from 'chai'
import UserHelper from './helpers/User.mjs'
import Features from '../../../app/src/infrastructure/Features.mjs'

const User = UserHelper.promises

describe('Project ownership transfer', function () {
  beforeEach(async function () {
    this.ownerSession = new User()
    this.collaboratorSession = new User()
    this.strangerSession = new User()
    this.adminSession = new User()
    this.invitedAdminSession = new User()
    await this.invitedAdminSession.ensureUserExists()
    await this.invitedAdminSession.ensureAdmin()
    await this.invitedAdminSession.login()
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
    this.invitedAdmin = await this.invitedAdminSession.get()
    this.projectId = await this.ownerSession.createProject('Test project')
    await this.ownerSession.addUserToProject(
      this.projectId,
      this.invitedAdmin,
      'readAndWrite'
    )
    await this.ownerSession.addUserToProject(
      this.projectId,
      this.collaborator,
      'readAndWrite'
    )
  })

  describe('happy path', function () {
    beforeEach(async function () {
      await this.ownerSession.transferProjectOwnership(
        this.projectId,
        this.collaborator._id
      )
    })

    it('changes the project owner', async function () {
      const project = await this.collaboratorSession.getProject(this.projectId)
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
    })

    it('adds the previous owner as a read/write collaborator', async function () {
      // Skip this test in SaaS environments as limited collaborators are enforced
      if (Features.hasFeature('saas')) {
        this.skip()
      }

      const project = await this.collaboratorSession.getProject(this.projectId)
      expect(project.collaberator_refs.map(x => x.toString())).to.have.members([
        this.owner._id.toString(),
        this.invitedAdmin._id.toString(),
      ])
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
      expect(project.readOnly_refs.map(x => x.toString())).to.be.empty
    })

    it('adds the previous owner as a read only', async function () {
      // Skip this test in non-SaaS environments as unlimited collaborators are allowed
      if (!Features.hasFeature('saas')) {
        this.skip()
      }

      const project = await this.collaboratorSession.getProject(this.projectId)
      expect(project.collaberator_refs.map(x => x.toString())).to.have.members([
        this.invitedAdmin._id.toString(),
      ])
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
      expect(project.readOnly_refs.map(x => x.toString())).to.have.members([
        this.owner._id.toString(),
      ])
    })

    it('lets the new owner open the project', async function () {
      await this.collaboratorSession.openProject(this.projectId)
    })

    it('lets the previous owner open the project', async function () {
      await this.ownerSession.openProject(this.projectId)
    })
  })

  describe('ownership change as admin', function () {
    it('lets the invited admin transfer ownership', async function () {
      await this.invitedAdminSession.transferProjectOwnership(
        this.projectId,
        this.collaborator._id
      )
      const project = await this.invitedAdminSession.getProject(this.projectId)
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
    })

    it('lets the non-invited admin transfer ownership', async function () {
      await this.adminSession.transferProjectOwnership(
        this.projectId,
        this.collaborator._id
      )
      const project = await this.adminSession.getProject(this.projectId)
      expect(project.owner_ref.toString()).to.equal(
        this.collaborator._id.toString()
      )
    })
  })

  describe('validation', function () {
    it('lets only the project owner transfer ownership', async function () {
      await expect(
        this.collaboratorSession.transferProjectOwnership(
          this.projectId,
          this.collaborator._id
        )
      ).to.be.rejectedWith(/failed: status=403 /)
    })

    it('prevents transfers to a non-collaborator', async function () {
      await expect(
        this.ownerSession.transferProjectOwnership(
          this.projectId,
          this.stranger._id
        )
      ).to.be.rejectedWith(/failed: status=403 /)
    })

    it('allows an admin to transfer to any project to a non-collaborator', async function () {
      await expect(
        this.adminSession.transferProjectOwnership(
          this.projectId,
          this.stranger._id
        )
      ).to.be.fulfilled
    })
  })
})
