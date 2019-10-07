const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongojs')
const { Project } = require('../helpers/models/Project')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH = Path.join(
  __dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsGetter'
)

describe('CollaboratorsGetter', function() {
  beforeEach(function() {
    this.userId = 'mock-user-id'
    this.ownerRef = ObjectId()
    this.readOnlyRef1 = ObjectId()
    this.readOnlyRef2 = ObjectId()
    this.readWriteRef1 = ObjectId()
    this.readWriteRef2 = ObjectId()
    this.readOnlyTokenRef = ObjectId()
    this.readWriteTokenRef = ObjectId()
    this.nonMemberRef = ObjectId()
    this.project = {
      _id: ObjectId(),
      owner_ref: [this.ownerRef],
      readOnly_refs: [this.readOnlyRef1, this.readOnlyRef2],
      collaberator_refs: [this.readWriteRef1, this.readWriteRef2],
      tokenAccessReadAndWrite_refs: [this.readWriteTokenRef],
      tokenAccessReadOnly_refs: [this.readOnlyTokenRef],
      publicAccesLevel: 'tokenBased'
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null)
      }
    }
    this.ProjectMock = sinon.mock(Project)
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project)
      }
    }
    this.ProjectEditorHandler = {
      buildOwnerAndMembersViews: sinon.stub()
    }
    this.CollaboratorsGetter = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        '../User/UserGetter': this.UserGetter,
        '../../models/Project': { Project },
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Errors/Errors': Errors,
        '../Project/ProjectEditorHandler': this.ProjectEditorHandler
      }
    })
  })

  afterEach(function() {
    this.ProjectMock.verify()
  })

  describe('getMemberIdsWithPrivilegeLevels', function() {
    describe('with project', function() {
      it('should return an array of member ids with their privilege levels', async function() {
        const result = await this.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
          this.project._id
        )
        expect(result).to.have.deep.members([
          {
            id: this.ownerRef.toString(),
            privilegeLevel: 'owner',
            source: 'owner'
          },
          {
            id: this.readWriteRef1.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          },
          {
            id: this.readWriteRef2.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite'
          },
          {
            id: this.readOnlyRef1.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite'
          },
          {
            id: this.readOnlyRef2.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite'
          },
          {
            id: this.readOnlyTokenRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'token'
          },
          {
            id: this.readWriteTokenRef.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'token'
          }
        ])
      })
    })

    describe('with a missing project', function() {
      beforeEach(function() {
        this.ProjectGetter.promises.getProject.resolves(null)
      })

      it('should return a NotFoundError', async function() {
        await expect(
          this.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
            this.project._id
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('getMemberIds', function() {
    it('should return the ids', async function() {
      const memberIds = await this.CollaboratorsGetter.promises.getMemberIds(
        this.project._id
      )
      expect(memberIds).to.have.members([
        this.ownerRef.toString(),
        this.readOnlyRef1.toString(),
        this.readOnlyRef2.toString(),
        this.readWriteRef1.toString(),
        this.readWriteRef2.toString(),
        this.readWriteTokenRef.toString(),
        this.readOnlyTokenRef.toString()
      ])
    })
  })

  describe('getInvitedMemberIds', function() {
    it('should return the invited ids', async function() {
      const memberIds = await this.CollaboratorsGetter.promises.getInvitedMemberIds(
        this.project._id
      )
      expect(memberIds).to.have.members([
        this.ownerRef.toString(),
        this.readOnlyRef1.toString(),
        this.readOnlyRef2.toString(),
        this.readWriteRef1.toString(),
        this.readWriteRef2.toString()
      ])
    })
  })

  describe('getInvitedMembersWithPrivilegeLevels', function() {
    beforeEach(function() {
      this.UserGetter.promises.getUser
        .withArgs(this.readOnlyRef1.toString())
        .resolves({ _id: this.readOnlyRef1 })
      this.UserGetter.promises.getUser
        .withArgs(this.readOnlyTokenRef.toString())
        .resolves({ _id: this.readOnlyTokenRef })
      this.UserGetter.promises.getUser
        .withArgs(this.readWriteRef2.toString())
        .resolves({ _id: this.readWriteRef2 })
      this.UserGetter.promises.getUser
        .withArgs(this.readWriteTokenRef.toString())
        .resolves({ _id: this.readWriteTokenRef })
    })

    it('should return an array of invited members with their privilege levels', async function() {
      const result = await this.CollaboratorsGetter.promises.getInvitedMembersWithPrivilegeLevels(
        this.project._id
      )
      expect(result).to.have.deep.members([
        { user: { _id: this.readOnlyRef1 }, privilegeLevel: 'readOnly' },
        { user: { _id: this.readWriteRef2 }, privilegeLevel: 'readAndWrite' }
      ])
    })
  })

  describe('getMemberIdPrivilegeLevel', function() {
    it('should return the privilege level if it exists', async function() {
      const level = await this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
        this.readOnlyRef1,
        this.project._id
      )
      expect(level).to.equal('readOnly')
    })

    it('should return false if the member has no privilege level', async function() {
      const level = await this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
        this.nonMemberRef,
        this.project._id
      )
      expect(level).to.equal(false)
    })
  })

  describe('isUserInvitedMemberOfProject', function() {
    describe('when user is a member of the project', function() {
      it('should return true and the privilegeLevel', async function() {
        const isMember = await this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
          this.readOnlyRef1
        )
        expect(isMember).to.equal(true)
      })
    })

    describe('when user is not a member of the project', function() {
      it('should return false', async function() {
        const isMember = await this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
          this.nonMemberRef
        )
        expect(isMember).to.equal(false)
      })
    })
  })

  describe('getProjectsUserIsMemberOf', function() {
    beforeEach(function() {
      this.fields = 'mock fields'
      this.ProjectMock.expects('find')
        .withArgs({ collaberator_refs: this.userId }, this.fields)
        .chain('exec')
        .resolves(['mock-read-write-project-1', 'mock-read-write-project-2'])

      this.ProjectMock.expects('find')
        .withArgs({ readOnly_refs: this.userId }, this.fields)
        .chain('exec')
        .resolves(['mock-read-only-project-1', 'mock-read-only-project-2'])
      this.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadAndWrite_refs: this.userId,
            publicAccesLevel: 'tokenBased'
          },
          this.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2'
        ])
      this.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadOnly_refs: this.userId,
            publicAccesLevel: 'tokenBased'
          },
          this.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2'
        ])
    })

    it('should call the callback with the projects', async function() {
      const projects = await this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf(
        this.userId,
        this.fields
      )
      expect(projects).to.deep.equal({
        readAndWrite: [
          'mock-read-write-project-1',
          'mock-read-write-project-2'
        ],
        readOnly: ['mock-read-only-project-1', 'mock-read-only-project-2'],
        tokenReadAndWrite: [
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2'
        ],
        tokenReadOnly: [
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2'
        ]
      })
    })
  })

  describe('getAllInvitedMembers', function() {
    beforeEach(async function() {
      this.owningUser = {
        _id: this.ownerRef,
        email: 'owner@example.com',
        features: { a: 1 }
      }
      this.readWriteUser = {
        _id: this.readWriteRef1,
        email: 'readwrite@example.com'
      }
      this.members = [
        { user: this.owningUser, privilegeLevel: 'owner' },
        { user: this.readWriteUser, privilegeLevel: 'readAndWrite' }
      ]
      this.views = {
        owner: this.owningUser,
        ownerFeatures: this.owningUser.features,
        members: [
          { _id: this.readWriteUser._id, email: this.readWriteUser.email }
        ]
      }
      this.UserGetter.promises.getUser
        .withArgs(this.owningUser._id.toString())
        .resolves(this.owningUser)
      this.UserGetter.promises.getUser
        .withArgs(this.readWriteUser._id.toString())
        .resolves(this.readWriteUser)
      this.ProjectEditorHandler.buildOwnerAndMembersViews.returns(this.views)
      this.result = await this.CollaboratorsGetter.promises.getAllInvitedMembers(
        this.project._id
      )
    })

    it('should produce a list of members', function() {
      expect(this.result).to.deep.equal(this.views.members)
    })

    it('should call ProjectEditorHandler.buildOwnerAndMembersViews', function() {
      expect(this.ProjectEditorHandler.buildOwnerAndMembersViews).to.have.been
        .calledOnce
      expect(
        this.ProjectEditorHandler.buildOwnerAndMembersViews
      ).to.have.been.calledWith(this.members)
    })
  })

  describe('userIsTokenMember', function() {
    it('should return true when the project is found', async function() {
      this.ProjectMock.expects('findOne')
        .chain('exec')
        .resolves(this.project)
      const isMember = await this.CollaboratorsGetter.promises.userIsTokenMember(
        this.userId,
        this.project._id
      )
      expect(isMember).to.be.true
    })

    it('should return false when the project is not found', async function() {
      this.ProjectMock.expects('findOne')
        .chain('exec')
        .resolves(null)
      const isMember = await this.CollaboratorsGetter.promises.userIsTokenMember(
        this.userId,
        this.project._id
      )
      expect(isMember).to.be.false
    })
  })
})
