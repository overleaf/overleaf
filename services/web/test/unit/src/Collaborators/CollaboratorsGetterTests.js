const Path = require('path')
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const { expect } = require('chai')
const { ObjectId } = require('mongodb-legacy')
const { Project } = require('../helpers/models/Project')
const Errors = require('../../../../app/src/Features/Errors/Errors')

const MODULE_PATH = Path.join(
  __dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsGetter'
)

describe('CollaboratorsGetter', function () {
  beforeEach(function () {
    this.userId = 'efb93a186e9a06f15fea5abd'
    this.ownerRef = new ObjectId()
    this.readOnlyRef1 = new ObjectId()
    this.readOnlyRef2 = new ObjectId()
    this.pendingEditorRef = new ObjectId()
    this.readWriteRef1 = new ObjectId()
    this.readWriteRef2 = new ObjectId()
    this.reviewer1Ref = new ObjectId()
    this.reviewer2Ref = new ObjectId()
    this.readOnlyTokenRef = new ObjectId()
    this.readWriteTokenRef = new ObjectId()
    this.nonMemberRef = new ObjectId()
    this.project = {
      _id: new ObjectId(),
      owner_ref: [this.ownerRef],
      readOnly_refs: [
        this.readOnlyRef1,
        this.readOnlyRef2,
        this.pendingEditorRef,
      ],
      pendingEditor_refs: [this.pendingEditorRef],
      collaberator_refs: [this.readWriteRef1, this.readWriteRef2],
      reviewer_refs: [this.reviewer1Ref, this.reviewer2Ref],
      tokenAccessReadAndWrite_refs: [this.readWriteTokenRef],
      tokenAccessReadOnly_refs: [this.readOnlyTokenRef],
      publicAccesLevel: 'tokenBased',
      tokens: {
        readOnly: 'ro',
        readAndWrite: 'rw',
        readAndWritePrefix: 'pre',
      },
    }

    this.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
      },
    }
    this.ProjectMock = sinon.mock(Project)
    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(this.project),
      },
    }
    this.ProjectEditorHandler = {
      buildOwnerAndMembersViews: sinon.stub(),
    }
    this.CollaboratorsGetter = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '../User/UserGetter': this.UserGetter,
        '../../models/Project': { Project },
        '../Project/ProjectGetter': this.ProjectGetter,
        '../Project/ProjectEditorHandler': this.ProjectEditorHandler,
      },
    })
  })

  afterEach(function () {
    this.ProjectMock.verify()
  })

  describe('getMemberIdsWithPrivilegeLevels', function () {
    describe('with project', function () {
      it('should return an array of member ids with their privilege levels', async function () {
        const result =
          await this.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
            this.project._id
          )
        expect(result).to.have.deep.members([
          {
            id: this.ownerRef.toString(),
            privilegeLevel: 'owner',
            source: 'owner',
          },
          {
            id: this.readWriteRef1.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite',
          },
          {
            id: this.readWriteRef2.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite',
          },
          {
            id: this.readOnlyRef1.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
          },
          {
            id: this.readOnlyRef2.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
          },
          {
            id: this.pendingEditorRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
            pendingEditor: true,
          },
          {
            id: this.readOnlyTokenRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'token',
          },
          {
            id: this.readWriteTokenRef.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'token',
          },
          {
            id: this.reviewer1Ref.toString(),
            privilegeLevel: 'review',
            source: 'invite',
          },
          {
            id: this.reviewer2Ref.toString(),
            privilegeLevel: 'review',
            source: 'invite',
          },
        ])
      })
    })

    describe('with a missing project', function () {
      beforeEach(function () {
        this.ProjectGetter.promises.getProject.resolves(null)
      })

      it('should return a NotFoundError', async function () {
        await expect(
          this.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
            this.project._id
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('getMemberIds', function () {
    it('should return the ids', async function () {
      const memberIds = await this.CollaboratorsGetter.promises.getMemberIds(
        this.project._id
      )
      expect(memberIds).to.have.members([
        this.ownerRef.toString(),
        this.readOnlyRef1.toString(),
        this.readOnlyRef2.toString(),
        this.readWriteRef1.toString(),
        this.readWriteRef2.toString(),
        this.pendingEditorRef.toString(),
        this.readWriteTokenRef.toString(),
        this.readOnlyTokenRef.toString(),
        this.reviewer1Ref.toString(),
        this.reviewer2Ref.toString(),
      ])
    })
  })

  describe('getInvitedMemberIds', function () {
    it('should return the invited ids', async function () {
      const memberIds =
        await this.CollaboratorsGetter.promises.getInvitedMemberIds(
          this.project._id
        )
      expect(memberIds).to.have.members([
        this.ownerRef.toString(),
        this.readOnlyRef1.toString(),
        this.readOnlyRef2.toString(),
        this.readWriteRef1.toString(),
        this.readWriteRef2.toString(),
        this.pendingEditorRef.toString(),
        this.reviewer1Ref.toString(),
        this.reviewer2Ref.toString(),
      ])
    })
  })

  describe('getInvitedMembersWithPrivilegeLevels', function () {
    beforeEach(function () {
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
      this.UserGetter.promises.getUser
        .withArgs(this.reviewer1Ref.toString())
        .resolves({ _id: this.reviewer1Ref })
    })

    it('should return an array of invited members with their privilege levels', async function () {
      const result =
        await this.CollaboratorsGetter.promises.getInvitedMembersWithPrivilegeLevels(
          this.project._id
        )
      expect(result).to.have.deep.members([
        { user: { _id: this.readOnlyRef1 }, privilegeLevel: 'readOnly' },
        { user: { _id: this.readWriteRef2 }, privilegeLevel: 'readAndWrite' },
        { user: { _id: this.reviewer1Ref }, privilegeLevel: 'review' },
      ])
    })
  })

  describe('getMemberIdPrivilegeLevel', function () {
    it('should return the privilege level if it exists', async function () {
      const level =
        await this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          this.readOnlyRef1,
          this.project._id
        )
      expect(level).to.equal('readOnly')
    })

    it('should return review privilege level', async function () {
      const level =
        await this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          this.reviewer1Ref,
          this.project._id
        )
      expect(level).to.equal('review')
    })

    it('should return false if the member has no privilege level', async function () {
      const level =
        await this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          this.nonMemberRef,
          this.project._id
        )
      expect(level).to.equal(false)
    })
  })

  describe('isUserInvitedMemberOfProject', function () {
    describe('when user is a member of the project', function () {
      it('should return true and the privilegeLevel', async function () {
        const isMember =
          await this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
            this.readOnlyRef1
          )
        expect(isMember).to.equal(true)
      })
    })

    describe('when user is not a member of the project', function () {
      it('should return false', async function () {
        const isMember =
          await this.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
            this.nonMemberRef
          )
        expect(isMember).to.equal(false)
      })
    })
  })

  describe('isUserInvitedReadWriteMemberOfProject', function () {
    describe('when user is a read write member of the project', function () {
      it('should return true', async function () {
        const isMember =
          await this.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            this.readWriteRef1
          )
        expect(isMember).to.equal(true)
      })
    })

    describe('when user is a read only member of the project', function () {
      it('should return false', async function () {
        const isMember =
          await this.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            this.readOnlyRef1
          )
        expect(isMember).to.equal(false)
      })
    })

    describe('when user is not a member of the project', function () {
      it('should return false', async function () {
        const isMember =
          await this.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            this.nonMemberRef
          )
        expect(isMember).to.equal(false)
      })
    })
  })

  describe('getProjectsUserIsMemberOf', function () {
    beforeEach(function () {
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
        .withArgs({ reviewer_refs: this.userId }, this.fields)
        .chain('exec')
        .resolves(['mock-review-project-1', 'mock-review-project-2'])
      this.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadAndWrite_refs: this.userId,
            publicAccesLevel: 'tokenBased',
          },
          this.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2',
        ])
      this.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadOnly_refs: this.userId,
            publicAccesLevel: 'tokenBased',
          },
          this.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2',
        ])
    })

    it('should call the callback with the projects', async function () {
      const projects =
        await this.CollaboratorsGetter.promises.getProjectsUserIsMemberOf(
          this.userId,
          this.fields
        )
      expect(projects).to.deep.equal({
        readAndWrite: [
          'mock-read-write-project-1',
          'mock-read-write-project-2',
        ],
        readOnly: ['mock-read-only-project-1', 'mock-read-only-project-2'],
        tokenReadAndWrite: [
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2',
        ],
        tokenReadOnly: [
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2',
        ],
        review: ['mock-review-project-1', 'mock-review-project-2'],
      })
    })
  })

  describe('getAllInvitedMembers', function () {
    beforeEach(async function () {
      this.owningUser = {
        _id: this.ownerRef,
        email: 'owner@example.com',
        features: { a: 1 },
      }
      this.readWriteUser = {
        _id: this.readWriteRef1,
        email: 'readwrite@example.com',
      }
      this.reviewUser = {
        _id: this.reviewer1Ref,
        email: 'review@example.com',
      }
      this.members = [
        { user: this.owningUser, privilegeLevel: 'owner' },
        { user: this.readWriteUser, privilegeLevel: 'readAndWrite' },
        { user: this.reviewUser, privilegeLevel: 'review' },
      ]
      this.views = {
        owner: this.owningUser,
        ownerFeatures: this.owningUser.features,
        members: [
          { _id: this.readWriteUser._id, email: this.readWriteUser.email },
          { _id: this.reviewUser._id, email: this.reviewUser.email },
        ],
      }
      this.UserGetter.promises.getUser
        .withArgs(this.owningUser._id.toString())
        .resolves(this.owningUser)
      this.UserGetter.promises.getUser
        .withArgs(this.readWriteUser._id.toString())
        .resolves(this.readWriteUser)
      this.UserGetter.promises.getUser
        .withArgs(this.reviewUser._id.toString())
        .resolves(this.reviewUser)
      this.ProjectEditorHandler.buildOwnerAndMembersViews.returns(this.views)
      this.result =
        await this.CollaboratorsGetter.promises.getAllInvitedMembers(
          this.project._id
        )
    })

    it('should produce a list of members', function () {
      expect(this.result).to.deep.equal(this.views.members)
    })

    it('should call ProjectEditorHandler.buildOwnerAndMembersViews', function () {
      expect(this.ProjectEditorHandler.buildOwnerAndMembersViews).to.have.been
        .calledOnce
      expect(
        this.ProjectEditorHandler.buildOwnerAndMembersViews
      ).to.have.been.calledWith(this.members)
    })
  })

  describe('userIsTokenMember', function () {
    it('should return true when the project is found', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(this.project)
      const isMember =
        await this.CollaboratorsGetter.promises.userIsTokenMember(
          this.userId,
          this.project._id
        )
      expect(isMember).to.be.true
    })

    it('should return false when the project is not found', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(null)
      const isMember =
        await this.CollaboratorsGetter.promises.userIsTokenMember(
          this.userId,
          this.project._id
        )
      expect(isMember).to.be.false
    })
  })

  describe('userIsReadWriteTokenMember', function () {
    it('should return true when the project is found', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(this.project)
      const isMember =
        await this.CollaboratorsGetter.promises.userIsReadWriteTokenMember(
          this.userId,
          this.project._id
        )
      expect(isMember).to.be.true
    })

    it('should return false when the project is not found', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(null)
      const isMember =
        await this.CollaboratorsGetter.promises.userIsReadWriteTokenMember(
          this.userId,
          this.project._id
        )
      expect(isMember).to.be.false
    })
  })

  describe('getPublicShareTokens', function () {
    const userMock = new ObjectId()

    it('should return null when the project is not found', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(undefined)
      const tokens =
        await this.CollaboratorsGetter.promises.getPublicShareTokens(
          userMock,
          this.project._id
        )
      expect(tokens).to.be.null
    })

    it('should return an empty object when the user is not owner or read-only collaborator', async function () {
      this.ProjectMock.expects('findOne').chain('exec').resolves(this.project)
      const tokens =
        await this.CollaboratorsGetter.promises.getPublicShareTokens(
          userMock,
          this.project._id
        )
      expect(tokens).to.deep.equal({})
    })

    describe('when the user is a read-only token collaborator', function () {
      it('should return the read-only token', async function () {
        this.ProjectMock.expects('findOne')
          .chain('exec')
          .resolves({ hasTokenReadOnlyAccess: true, ...this.project })

        const tokens =
          await this.CollaboratorsGetter.promises.getPublicShareTokens(
            userMock,
            this.project._id
          )
        expect(tokens).to.deep.equal({ readOnly: tokens.readOnly })
      })
    })

    describe('when the user is the owner of the project', function () {
      beforeEach(function () {
        this.ProjectMock.expects('findOne')
          .chain('exec')
          .resolves({ isOwner: true, ...this.project })
      })

      it('should return all the tokens', async function () {
        const tokens =
          await this.CollaboratorsGetter.promises.getPublicShareTokens(
            userMock,
            this.project._id
          )
        expect(tokens).to.deep.equal(tokens)
      })
    })
  })

  describe('getInvitedEditCollaboratorCount', function () {
    it('should return the count of invited edit collaborators (token, readAndWrite)', async function () {
      const count =
        await this.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount(
          this.project._id
        )
      expect(count).to.equal(2)
    })
  })

  describe('getInvitedPendingEditorCount', function () {
    it('should return the count of pending editors', async function () {
      const count =
        await this.CollaboratorsGetter.promises.getInvitedPendingEditorCount(
          this.project._id
        )
      expect(count).to.equal(1)
    })
  })
})
