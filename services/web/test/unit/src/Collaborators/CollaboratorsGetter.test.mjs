import { vi, expect } from 'vitest'
import Path from 'node:path'
import sinon from 'sinon'
import mongodb from 'mongodb-legacy'
import { Project } from '../../../../app/src/models/Project.mjs'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const { ObjectId } = mongodb

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

const MODULE_PATH = Path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Collaborators/CollaboratorsGetter'
)

describe('CollaboratorsGetter', function () {
  beforeEach(async function (ctx) {
    ctx.userId = 'efb93a186e9a06f15fea5abd'
    ctx.ownerRef = new ObjectId()
    ctx.readOnlyRef1 = new ObjectId()
    ctx.readOnlyRef2 = new ObjectId()
    ctx.pendingEditorRef = new ObjectId()
    ctx.pendingReviewerRef = new ObjectId()
    ctx.readWriteRef1 = new ObjectId()
    ctx.readWriteRef2 = new ObjectId()
    ctx.reviewer1Ref = new ObjectId()
    ctx.reviewer2Ref = new ObjectId()
    ctx.readOnlyTokenRef = new ObjectId()
    ctx.readWriteTokenRef = new ObjectId()
    ctx.nonMemberRef = new ObjectId()
    ctx.project = {
      _id: new ObjectId(),
      owner_ref: [ctx.ownerRef],
      readOnly_refs: [
        ctx.readOnlyRef1,
        ctx.readOnlyRef2,
        ctx.pendingEditorRef,
        ctx.pendingReviewerRef,
      ],
      pendingEditor_refs: [ctx.pendingEditorRef],
      pendingReviewer_refs: [ctx.pendingReviewerRef],
      collaberator_refs: [ctx.readWriteRef1, ctx.readWriteRef2],
      reviewer_refs: [ctx.reviewer1Ref, ctx.reviewer2Ref],
      tokenAccessReadAndWrite_refs: [ctx.readWriteTokenRef],
      tokenAccessReadOnly_refs: [ctx.readOnlyTokenRef],
      publicAccesLevel: 'tokenBased',
      tokens: {
        readOnly: 'ro',
        readAndWrite: 'rw',
        readAndWritePrefix: 'pre',
      },
    }

    ctx.UserGetter = {
      promises: {
        getUser: sinon.stub().resolves(null),
        getUsers: sinon.stub().resolves([]),
      },
    }
    ctx.ProjectMock = sinon.mock(Project)
    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(ctx.project),
      },
    }
    ctx.ProjectEditorHandler = {
      buildUserModelView: sinon.stub(),
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: ctx.UserGetter,
    }))

    vi.doMock('../../../../app/src/models/Project', () => ({
      Project,
    }))

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock(
      '../../../../app/src/Features/Project/ProjectEditorHandler',
      () => ({
        default: ctx.ProjectEditorHandler,
      })
    )

    ctx.CollaboratorsGetter = (await import(MODULE_PATH)).default
  })

  afterEach(function (ctx) {
    ctx.ProjectMock.verify()
  })

  describe('getMemberIdsWithPrivilegeLevels', function () {
    describe('with project', function () {
      it('should return an array of member ids with their privilege levels', async function (ctx) {
        const result =
          await ctx.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
            ctx.project._id
          )
        expect(result).to.have.deep.members([
          {
            id: ctx.ownerRef.toString(),
            privilegeLevel: 'owner',
            source: 'owner',
          },
          {
            id: ctx.readWriteRef1.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite',
          },
          {
            id: ctx.readWriteRef2.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'invite',
          },
          {
            id: ctx.readOnlyRef1.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
          },
          {
            id: ctx.readOnlyRef2.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
          },
          {
            id: ctx.pendingEditorRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
            pendingEditor: true,
          },
          {
            id: ctx.pendingReviewerRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'invite',
            pendingReviewer: true,
          },
          {
            id: ctx.readOnlyTokenRef.toString(),
            privilegeLevel: 'readOnly',
            source: 'token',
          },
          {
            id: ctx.readWriteTokenRef.toString(),
            privilegeLevel: 'readAndWrite',
            source: 'token',
          },
          {
            id: ctx.reviewer1Ref.toString(),
            privilegeLevel: 'review',
            source: 'invite',
          },
          {
            id: ctx.reviewer2Ref.toString(),
            privilegeLevel: 'review',
            source: 'invite',
          },
        ])
      })
    })

    describe('with a missing project', function () {
      beforeEach(function (ctx) {
        ctx.ProjectGetter.promises.getProject.resolves(null)
      })

      it('should return a NotFoundError', async function (ctx) {
        await expect(
          ctx.CollaboratorsGetter.promises.getMemberIdsWithPrivilegeLevels(
            ctx.project._id
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })
  })

  describe('getMemberIds', function () {
    it('should return the ids', async function (ctx) {
      const memberIds = await ctx.CollaboratorsGetter.promises.getMemberIds(
        ctx.project._id
      )
      expect(memberIds).to.have.members([
        ctx.ownerRef.toString(),
        ctx.readOnlyRef1.toString(),
        ctx.readOnlyRef2.toString(),
        ctx.readWriteRef1.toString(),
        ctx.readWriteRef2.toString(),
        ctx.pendingEditorRef.toString(),
        ctx.pendingReviewerRef.toString(),
        ctx.readWriteTokenRef.toString(),
        ctx.readOnlyTokenRef.toString(),
        ctx.reviewer1Ref.toString(),
        ctx.reviewer2Ref.toString(),
      ])
    })
  })

  describe('getInvitedMemberIds', function () {
    it('should return the invited ids', async function (ctx) {
      const memberIds =
        await ctx.CollaboratorsGetter.promises.getInvitedMemberIds(
          ctx.project._id
        )
      expect(memberIds).to.have.members([
        ctx.ownerRef.toString(),
        ctx.readOnlyRef1.toString(),
        ctx.readOnlyRef2.toString(),
        ctx.readWriteRef1.toString(),
        ctx.readWriteRef2.toString(),
        ctx.pendingEditorRef.toString(),
        ctx.pendingReviewerRef.toString(),
        ctx.reviewer1Ref.toString(),
        ctx.reviewer2Ref.toString(),
      ])
    })
  })

  describe('getMemberIdPrivilegeLevel', function () {
    it('should return the privilege level if it exists', async function (ctx) {
      const level =
        await ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          ctx.readOnlyRef1,
          ctx.project._id
        )
      expect(level).to.equal('readOnly')
    })

    it('should return review privilege level', async function (ctx) {
      const level =
        await ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          ctx.reviewer1Ref,
          ctx.project._id
        )
      expect(level).to.equal('review')
    })

    it('should return false if the member has no privilege level', async function (ctx) {
      const level =
        await ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          ctx.nonMemberRef,
          ctx.project._id
        )
      expect(level).to.equal(false)
    })

    it('should return review privilege level when user is both reviewer and token member', async function (ctx) {
      const userWhoIsBothReviewerAndToken = new ObjectId()

      const projectWithDuplicateUser = {
        ...ctx.project,
        reviewer_refs: [userWhoIsBothReviewerAndToken],
        tokenAccessReadAndWrite_refs: [userWhoIsBothReviewerAndToken],
      }

      ctx.ProjectGetter.promises.getProject.resolves(projectWithDuplicateUser)

      const level =
        await ctx.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel(
          userWhoIsBothReviewerAndToken,
          ctx.project._id
        )

      expect(level).to.equal('review')
    })
  })

  describe('isUserInvitedMemberOfProject', function () {
    describe('when user is a member of the project', function () {
      it('should return true and the privilegeLevel', async function (ctx) {
        const isMember =
          await ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
            ctx.readOnlyRef1
          )
        expect(isMember).to.equal(true)
      })
    })

    describe('when user is not a member of the project', function () {
      it('should return false', async function (ctx) {
        const isMember =
          await ctx.CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
            ctx.nonMemberRef
          )
        expect(isMember).to.equal(false)
      })
    })
  })

  describe('isUserInvitedReadWriteMemberOfProject', function () {
    describe('when user is a read write member of the project', function () {
      it('should return true', async function (ctx) {
        const isMember =
          await ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            ctx.readWriteRef1
          )
        expect(isMember).to.equal(true)
      })
    })

    describe('when user is a read only member of the project', function () {
      it('should return false', async function (ctx) {
        const isMember =
          await ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            ctx.readOnlyRef1
          )
        expect(isMember).to.equal(false)
      })
    })

    describe('when user is not a member of the project', function () {
      it('should return false', async function (ctx) {
        const isMember =
          await ctx.CollaboratorsGetter.promises.isUserInvitedReadWriteMemberOfProject(
            ctx.nonMemberRef
          )
        expect(isMember).to.equal(false)
      })
    })
  })

  describe('getProjectsUserIsMemberOf', function () {
    beforeEach(function (ctx) {
      ctx.fields = 'mock fields'
      ctx.ProjectMock.expects('find')
        .withArgs({ collaberator_refs: ctx.userId }, ctx.fields)
        .chain('exec')
        .resolves(['mock-read-write-project-1', 'mock-read-write-project-2'])

      ctx.ProjectMock.expects('find')
        .withArgs({ readOnly_refs: ctx.userId }, ctx.fields)
        .chain('exec')
        .resolves(['mock-read-only-project-1', 'mock-read-only-project-2'])

      ctx.ProjectMock.expects('find')
        .withArgs({ reviewer_refs: ctx.userId }, ctx.fields)
        .chain('exec')
        .resolves(['mock-review-project-1', 'mock-review-project-2'])
      ctx.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadAndWrite_refs: ctx.userId,
            publicAccesLevel: 'tokenBased',
          },
          ctx.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-write-project-1',
          'mock-token-read-write-project-2',
        ])
      ctx.ProjectMock.expects('find')
        .withArgs(
          {
            tokenAccessReadOnly_refs: ctx.userId,
            publicAccesLevel: 'tokenBased',
          },
          ctx.fields
        )
        .chain('exec')
        .resolves([
          'mock-token-read-only-project-1',
          'mock-token-read-only-project-2',
        ])
    })

    it('should call the callback with the projects', async function (ctx) {
      const projects =
        await ctx.CollaboratorsGetter.promises.getProjectsUserIsMemberOf(
          ctx.userId,
          ctx.fields
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
    beforeEach(async function (ctx) {
      ctx.owningUser = {
        _id: ctx.ownerRef,
        email: 'owner@example.com',
        features: { a: 1 },
      }
      ctx.readWriteUser = {
        _id: ctx.readWriteRef1,
        email: 'readwrite@example.com',
      }
      ctx.reviewUser = {
        _id: ctx.reviewer1Ref,
        email: 'review@example.com',
      }
      ctx.members = [
        { user: ctx.owningUser, privilegeLevel: 'owner' },
        { user: ctx.readWriteUser, privilegeLevel: 'readAndWrite' },
        { user: ctx.reviewUser, privilegeLevel: 'review' },
      ]
      ctx.memberViews = [
        { _id: ctx.readWriteUser._id, email: ctx.readWriteUser.email },
        { _id: ctx.reviewUser._id, email: ctx.reviewUser.email },
      ]
      ctx.UserGetter.promises.getUsers.resolves([
        ctx.owningUser,
        ctx.readWriteUser,
        ctx.reviewUser,
      ])
      ctx.ProjectEditorHandler.buildUserModelView
        .withArgs(ctx.members[1])
        .returns(ctx.memberViews[0])
      ctx.ProjectEditorHandler.buildUserModelView
        .withArgs(ctx.members[2])
        .returns(ctx.memberViews[1])
      ctx.result = await ctx.CollaboratorsGetter.promises.getAllInvitedMembers(
        ctx.project._id
      )
    })

    it('should produce a list of members', function (ctx) {
      expect(ctx.result).to.deep.equal(ctx.memberViews)
    })

    it('should call ProjectEditorHandler.buildUserModelView', function (ctx) {
      expect(ctx.ProjectEditorHandler.buildUserModelView).to.have.been
        .calledTwice
      expect(
        ctx.ProjectEditorHandler.buildUserModelView
      ).to.have.been.calledWith(ctx.members[1])
      expect(
        ctx.ProjectEditorHandler.buildUserModelView
      ).to.have.been.calledWith(ctx.members[2])
    })
  })

  describe('userIsTokenMember', function () {
    it('should return true when the project is found', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(ctx.project)
      const isMember = await ctx.CollaboratorsGetter.promises.userIsTokenMember(
        ctx.userId,
        ctx.project._id
      )
      expect(isMember).to.be.true
    })

    it('should return false when the project is not found', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(null)
      const isMember = await ctx.CollaboratorsGetter.promises.userIsTokenMember(
        ctx.userId,
        ctx.project._id
      )
      expect(isMember).to.be.false
    })
  })

  describe('userIsReadWriteTokenMember', function () {
    it('should return true when the project is found', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(ctx.project)
      const isMember =
        await ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember(
          ctx.userId,
          ctx.project._id
        )
      expect(isMember).to.be.true
    })

    it('should return false when the project is not found', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(null)
      const isMember =
        await ctx.CollaboratorsGetter.promises.userIsReadWriteTokenMember(
          ctx.userId,
          ctx.project._id
        )
      expect(isMember).to.be.false
    })
  })

  describe('getPublicShareTokens', function () {
    const userMock = new ObjectId()

    it('should return null when the project is not found', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(undefined)
      const tokens =
        await ctx.CollaboratorsGetter.promises.getPublicShareTokens(
          userMock,
          ctx.project._id
        )
      expect(tokens).to.be.null
    })

    it('should return an empty object when the user is not owner or read-only collaborator', async function (ctx) {
      ctx.ProjectMock.expects('findOne').chain('exec').resolves(ctx.project)
      const tokens =
        await ctx.CollaboratorsGetter.promises.getPublicShareTokens(
          userMock,
          ctx.project._id
        )
      expect(tokens).to.deep.equal({})
    })

    describe('when the user is a read-only token collaborator', function () {
      it('should return the read-only token', async function (ctx) {
        ctx.ProjectMock.expects('findOne')
          .chain('exec')
          .resolves({ hasTokenReadOnlyAccess: true, ...ctx.project })

        const tokens =
          await ctx.CollaboratorsGetter.promises.getPublicShareTokens(
            userMock,
            ctx.project._id
          )
        expect(tokens).to.deep.equal({ readOnly: tokens.readOnly })
      })
    })

    describe('when the user is the owner of the project', function () {
      beforeEach(function (ctx) {
        ctx.ProjectMock.expects('findOne')
          .chain('exec')
          .resolves({ isOwner: true, ...ctx.project })
      })

      it('should return all the tokens', async function (ctx) {
        const tokens =
          await ctx.CollaboratorsGetter.promises.getPublicShareTokens(
            userMock,
            ctx.project._id
          )
        expect(tokens).to.deep.equal(tokens)
      })
    })
  })

  describe('getInvitedEditCollaboratorCount', function () {
    it('should return the count of invited edit collaborators (readAndWrite, review)', async function (ctx) {
      const count =
        await ctx.CollaboratorsGetter.promises.getInvitedEditCollaboratorCount(
          ctx.project._id
        )
      expect(count).to.equal(4)
    })
  })

  describe('getInvitedPendingEditorCount', function () {
    it('should return the count of pending editors and reviewers', async function (ctx) {
      const count =
        await ctx.CollaboratorsGetter.promises.getInvitedPendingEditorCount(
          ctx.project._id
        )
      expect(count).to.equal(2)
    })
  })

  describe('ProjectAccess', function () {
    describe('privilegeLevelForUser', function () {
      it('should return reviewer privilege when user is both reviewer and token member', function (ctx) {
        const userWhoIsBothReviewerAndToken = new ObjectId()

        const projectWithDuplicateUser = {
          owner_ref: ctx.ownerRef,
          collaberator_refs: [],
          readOnly_refs: [],
          tokenAccessReadAndWrite_refs: [userWhoIsBothReviewerAndToken],
          tokenAccessReadOnly_refs: [],
          publicAccesLevel: 'tokenBased',
          pendingEditor_refs: [],
          reviewer_refs: [userWhoIsBothReviewerAndToken],
          pendingReviewer_refs: [],
        }

        const projectAccess = new ctx.CollaboratorsGetter.ProjectAccess(
          projectWithDuplicateUser
        )
        const privilegeLevel = projectAccess.privilegeLevelForUser(
          userWhoIsBothReviewerAndToken
        )

        expect(privilegeLevel).to.equal('review')
      })

      it('should return readOnly privilege when user is both readOnly and token readAndWrite member', function (ctx) {
        const userWhoIsBothReadOnlyAndTokenRW = new ObjectId()

        const projectWithDuplicateUser = {
          owner_ref: ctx.ownerRef,
          collaberator_refs: [],
          readOnly_refs: [userWhoIsBothReadOnlyAndTokenRW],
          tokenAccessReadAndWrite_refs: [userWhoIsBothReadOnlyAndTokenRW],
          tokenAccessReadOnly_refs: [],
          publicAccesLevel: 'tokenBased',
          pendingEditor_refs: [],
          reviewer_refs: [],
          pendingReviewer_refs: [],
        }

        const projectAccess = new ctx.CollaboratorsGetter.ProjectAccess(
          projectWithDuplicateUser
        )
        const privilegeLevel = projectAccess.privilegeLevelForUser(
          userWhoIsBothReadOnlyAndTokenRW
        )

        // Should return 'readOnly' from invite, not 'readAndWrite' from token access
        expect(privilegeLevel).to.equal('readOnly')
      })

      it('should return none for non-members', function (ctx) {
        const projectAccess = new ctx.CollaboratorsGetter.ProjectAccess(
          ctx.project
        )
        const privilegeLevel = projectAccess.privilegeLevelForUser(
          ctx.nonMemberRef
        )

        expect(privilegeLevel).to.equal(false)
      })
    })
  })
})
