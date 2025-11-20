import { beforeEach, describe, it, vi, expect } from 'vitest'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import PrivilegeLevels from '../../../../app/src/Features/Authorization/PrivilegeLevels.mjs'
import PublicAccessLevels from '../../../../app/src/Features/Authorization/PublicAccessLevels.mjs'
import mongodb from 'mongodb-legacy'
const modulePath =
  '../../../../app/src/Features/Authorization/AuthorizationManager.mjs'

const { ObjectId } = mongodb

describe('AuthorizationManager', function () {
  beforeEach(async function (ctx) {
    ctx.user = { _id: new ObjectId() }
    ctx.project = { _id: new ObjectId() }
    ctx.doc = { _id: new ObjectId() }
    ctx.thread = { _id: new ObjectId() }
    ctx.token = 'some-token'

    ctx.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(null),
      },
    }
    ctx.ProjectGetter.promises.getProject
      .withArgs(ctx.project._id)
      .resolves(ctx.project)

    ctx.CollaboratorsGetter = {
      promises: {
        getProjectAccess: sinon.stub().resolves({
          publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
          privilegeLevelForUser: sinon.stub().returns(PrivilegeLevels.NONE),
        }),
      },
    }

    ctx.CollaboratorsHandler = {}

    ctx.User = {
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
    }
    ctx.User.findOne
      .withArgs({ _id: ctx.user._id })
      .returns({ exec: sinon.stub().resolves(ctx.user) })

    ctx.TokenAccessHandler = {
      promises: {
        validateTokenForAnonymousAccess: sinon
          .stub()
          .resolves({ isValidReadAndWrite: false, isValidReadOnly: false }),
      },
    }

    ctx.ChatApiHandler = {
      promises: {
        getThread: sinon
          .stub()
          .resolves({ messages: [{ user_id: new ObjectId() }] }),
      },
    }
    ctx.Features = {
      hasFeature: sinon.stub().returns(true),
    }
    ctx.Modules = { promises: { hooks: { fire: sinon.stub() } } }
    ctx.settings = {
      passwordStrengthOptions: {},
      adminPrivilegeAvailable: true,
      adminRolesEnabled: false,
      moduleImportSequence: [],
    }

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/infrastructure/Features', () => ({
      default: ctx.Features,
    }))

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsGetter',
      () => ({
        default: ctx.CollaboratorsGetter,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Collaborators/CollaboratorsHandler',
      () => ({
        default: ctx.CollaboratorsHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Project/ProjectGetter', () => ({
      default: ctx.ProjectGetter,
    }))

    vi.doMock('../../../../app/src/models/User', () => ({
      User: ctx.User,
    }))

    vi.doMock(
      '../../../../app/src/Features/TokenAccess/TokenAccessHandler',
      () => ({
        default: ctx.TokenAccessHandler,
      })
    )

    vi.doMock('../../../../app/src/Features/Chat/ChatApiHandler', () => ({
      default: ctx.ChatApiHandler,
    }))

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: ctx.Modules,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.AuthorizationManager = (await import(modulePath)).default
  })

  describe('isRestrictedUser', function () {
    it('should produce the correct values', function (ctx) {
      const notRestrictedScenarios = [
        [null, 'readAndWrite', false, false],
        ['id', 'readAndWrite', true, false],
        ['id', 'readAndWrite', true, true],
        ['id', 'readOnly', false, false],
        ['id', 'readOnly', false, true],
        ['id', 'review', false, true],
      ]
      const restrictedScenarios = [
        [null, 'readOnly', false, false],
        ['id', 'readOnly', true, false],
        [null, false, true, false],
        [null, false, false, false],
        ['id', false, true, false],
        ['id', false, false, false],
      ]
      for (const notRestrictedArgs of notRestrictedScenarios) {
        expect(
          ctx.AuthorizationManager.isRestrictedUser(...notRestrictedArgs)
        ).to.equal(false)
      }
      for (const restrictedArgs of restrictedScenarios) {
        expect(
          ctx.AuthorizationManager.isRestrictedUser(...restrictedArgs)
        ).to.equal(true)
      }
    })
  })

  describe('getPrivilegeLevelForProject', function () {
    describe('with a token-based project', function () {
      beforeEach(function (ctx) {
        ctx.project.publicAccesLevel = 'tokenBased'
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess
            .withArgs(ctx.project._id)
            .resolves({
              publicAccessLevel: sinon
                .stub()
                .returns(PublicAccessLevels.PRIVATE),
              privilegeLevelForUser: sinon
                .stub()
                .withArgs(ctx.user._id)
                .returns(PrivilegeLevels.READ_ONLY),
            })
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it("should return the user's privilege level", function (ctx) {
          expect(ctx.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return false', function (ctx) {
          expect(ctx.result).to.equal(false)
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.user.isAdmin = true
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return the user as an owner', function (ctx) {
          expect(ctx.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        describe('when the token is not valid', function () {
          beforeEach(async function (ctx) {
            ctx.result =
              await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                ctx.project._id,
                ctx.token
              )
          })

          it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
            ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function (ctx) {
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              ctx.project._id,
              ctx.token
            )
          })

          it('should return false', function (ctx) {
            expect(ctx.result).to.equal(false)
          })
        })

        describe('when the token is valid for read-and-write', function () {
          beforeEach(async function (ctx) {
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess =
              sinon
                .stub()
                .withArgs(ctx.project._id, ctx.token)
                .resolves({ isValidReadAndWrite: true, isValidReadOnly: false })
            ctx.result =
              await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                ctx.project._id,
                ctx.token
              )
          })

          it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
            ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function (ctx) {
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              ctx.project._id,
              ctx.token
            )
          })

          it('should give read-write access', function (ctx) {
            expect(ctx.result).to.equal('readAndWrite')
          })
        })

        describe('when the token is valid for read-only', function () {
          beforeEach(async function (ctx) {
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess =
              sinon
                .stub()
                .withArgs(ctx.project._id, ctx.token)
                .resolves({ isValidReadAndWrite: false, isValidReadOnly: true })
            ctx.result =
              await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                ctx.project._id,
                ctx.token
              )
          })

          it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
            ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function (ctx) {
            ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              ctx.project._id,
              ctx.token
            )
          })

          it('should give read-only access', function (ctx) {
            expect(ctx.result).to.equal('readOnly')
          })
        })
      })
    })

    describe('with a private project', function () {
      beforeEach(function (ctx) {
        ctx.project.publicAccesLevel = 'private'
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess
            .withArgs(ctx.project._id)
            .resolves({
              publicAccessLevel: sinon
                .stub()
                .returns(PublicAccessLevels.PRIVATE),
              privilegeLevelForUser: sinon
                .stub()
                .withArgs(ctx.user._id)
                .returns(PrivilegeLevels.READ_ONLY),
            })
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it("should return the user's privilege level", function (ctx) {
          expect(ctx.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return false', function (ctx) {
          expect(ctx.result).to.equal(false)
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.user.isAdmin = true
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return the user as an owner', function (ctx) {
          expect(ctx.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              null,
              ctx.project._id,
              ctx.token
            )
        })

        it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
            false
          )
        })

        it('should return false', function (ctx) {
          expect(ctx.result).to.equal(false)
        })
      })
    })

    describe('with a public project', function () {
      beforeEach(function (ctx) {
        ctx.project.publicAccesLevel = 'readAndWrite'
        ctx.CollaboratorsGetter.promises.getProjectAccess
          .withArgs(ctx.project._id)
          .resolves({
            publicAccessLevel: sinon
              .stub()
              .returns(ctx.project.publicAccesLevel),
            privilegeLevelForUser: sinon
              .stub()
              .withArgs(ctx.user._id)
              .returns(PrivilegeLevels.NONE),
          })
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess
            .withArgs(ctx.project._id)
            .resolves({
              publicAccessLevel: sinon
                .stub()
                .returns(ctx.project.publicAccesLevel),
              privilegeLevelForUser: sinon
                .stub()
                .withArgs(ctx.user._id)
                .returns(PrivilegeLevels.READ_ONLY),
            })
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it("should return the user's privilege level", function (ctx) {
          expect(ctx.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return the public privilege level', function (ctx) {
          expect(ctx.result).to.equal('readAndWrite')
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function (ctx) {
          ctx.user.isAdmin = true
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              ctx.user._id,
              ctx.project._id,
              ctx.token
            )
        })

        it('should return the user as an owner', function (ctx) {
          expect(ctx.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        beforeEach(async function (ctx) {
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              null,
              ctx.project._id,
              ctx.token
            )
        })

        it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
            false
          )
        })

        it('should return the public privilege level', function (ctx) {
          expect(ctx.result).to.equal('readAndWrite')
        })
      })

      describe('with link-sharing disabled', function () {
        beforeEach(async function (ctx) {
          ctx.Features.hasFeature.withArgs('link-sharing').returns(false)
          ctx.result =
            await ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
              null,
              ctx.project._id,
              ctx.token
            )
        })

        it('should not call CollaboratorsGetter.getProjectAccess', function (ctx) {
          ctx.CollaboratorsGetter.promises.getProjectAccess.called.should.equal(
            false
          )
        })

        it('should return false', function (ctx) {
          expect(ctx.result).to.equal(false)
        })
      })
    })

    describe("when the project doesn't exist", function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsGetter.promises.getProjectAccess.rejects(
          new Errors.NotFoundError()
        )
      })
      it('should return a NotFoundError', async function (ctx) {
        const someOtherId = new ObjectId()
        await expect(
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
            ctx.user._id,
            someOtherId,
            ctx.token
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('when the project id is not valid', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsGetter.promises.getProjectAccess
          .withArgs(ctx.project._id)
          .resolves({
            publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
            privilegeLevelForUser: sinon
              .stub()
              .withArgs(ctx.user._id)
              .returns(PrivilegeLevels.READ_ONLY),
          })
      })

      it('should return a error', async function (ctx) {
        await expect(
          ctx.AuthorizationManager.promises.getPrivilegeLevelForProject(
            undefined,
            'not project id',
            ctx.token
          )
        ).to.be.rejected
      })
    })
  })

  testPermission('canUserReadProject', {
    siteAdmin: true,
    owner: true,
    readAndWrite: true,
    review: true,
    readOnly: true,
    publicReadAndWrite: true,
    publicReadOnly: true,
    tokenReadAndWrite: true,
    tokenReadOnly: true,
  })

  testPermission('canUserWriteOrReviewProjectContent', {
    siteAdmin: true,
    owner: true,
    readAndWrite: true,
    review: true,
    publicReadAndWrite: true,
    tokenReadAndWrite: true,
  })

  testPermission('canUserWriteProjectContent', {
    siteAdmin: true,
    owner: true,
    readAndWrite: true,
    publicReadAndWrite: true,
    tokenReadAndWrite: true,
  })

  testPermission('canUserWriteProjectSettings', {
    siteAdmin: true,
    owner: true,
    readAndWrite: true,
    tokenReadAndWrite: true,
  })

  testPermission('canUserRenameProject', {
    siteAdmin: true,
    owner: true,
  })

  testPermission('canUserAdminProject', { siteAdmin: true, owner: true })

  describe('isUserSiteAdmin', function () {
    describe('when user is admin', function () {
      beforeEach(function (ctx) {
        ctx.user.isAdmin = true
      })

      it('should return true', async function (ctx) {
        const isAdmin = await ctx.AuthorizationManager.promises.isUserSiteAdmin(
          ctx.user._id
        )
        expect(isAdmin).to.equal(true)
      })
    })

    describe('when user is not admin', function () {
      it('should return false', async function (ctx) {
        const isAdmin = await ctx.AuthorizationManager.promises.isUserSiteAdmin(
          ctx.user._id
        )
        expect(isAdmin).to.equal(false)
      })
    })

    describe('when user is not found', function () {
      it('should return false', async function (ctx) {
        const someOtherId = new ObjectId()
        const isAdmin =
          await ctx.AuthorizationManager.promises.isUserSiteAdmin(someOtherId)
        expect(isAdmin).to.equal(false)
      })
    })

    describe('when no user is passed', function () {
      it('should return false', async function (ctx) {
        const isAdmin =
          await ctx.AuthorizationManager.promises.isUserSiteAdmin(null)
        expect(isAdmin).to.equal(false)
      })
    })
  })

  describe('canUserDeleteOrResolveThread', function () {
    it('should return true when user has write permissions', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getProjectAccess
        .withArgs(ctx.project._id)
        .resolves({
          publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
          privilegeLevelForUser: sinon
            .stub()
            .withArgs(ctx.user._id)
            .returns(PrivilegeLevels.READ_AND_WRITE),
        })

      const canResolve =
        await ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread(
          ctx.user._id,
          ctx.project._id,
          ctx.thread._id,
          ctx.token
        )

      expect(canResolve).to.equal(true)
    })

    it('should return false when user has read permission', async function (ctx) {
      ctx.CollaboratorsGetter.promises.getProjectAccess
        .withArgs(ctx.project._id)
        .resolves({
          publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
          privilegeLevelForUser: sinon
            .stub()
            .withArgs(ctx.user._id)
            .returns(PrivilegeLevels.READ_ONLY),
        })

      const canResolve =
        await ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread(
          ctx.user._id,
          ctx.project._id,
          ctx.thread._id,
          ctx.token
        )

      expect(canResolve).to.equal(false)
    })

    describe('when user has review permission', function () {
      beforeEach(function (ctx) {
        ctx.CollaboratorsGetter.promises.getProjectAccess
          .withArgs(ctx.project._id)
          .resolves({
            publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
            privilegeLevelForUser: sinon
              .stub()
              .withArgs(ctx.user._id)
              .returns(PrivilegeLevels.REVIEW),
          })
      })

      it('should return false when user is not the comment author', async function (ctx) {
        const canResolve =
          await ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread(
            ctx.user._id,
            ctx.project._id,
            ctx.thread._id,
            ctx.token
          )

        expect(canResolve).to.equal(false)
      })

      it('should return true when user is the thread author', async function (ctx) {
        ctx.ChatApiHandler.promises.getThread
          .withArgs(ctx.project._id, ctx.thread._id)
          .resolves({ messages: [{ user_id: ctx.user._id }] })

        const canResolve =
          await ctx.AuthorizationManager.promises.canUserDeleteOrResolveThread(
            ctx.user._id,
            ctx.project._id,
            ctx.thread._id,
            ctx.token
          )

        expect(canResolve).to.equal(true)
      })
    })
  })
})

function testPermission(permission, privilegeLevels) {
  describe(permission, function () {
    describe('when authenticated', function () {
      describe('when user is site admin', function () {
        beforeEach(function (ctx) {
          ctx.annotate('Set user as site admin')
          ctx.user.isAdmin = true
        })
        expectPermission(permission, privilegeLevels.siteAdmin || false)
      })
      describe('admin without permissions', function () {
        beforeEach(function (ctx) {
          ctx.user.isAdmin = true
          ctx.settings.adminRolesEnabled = true
          ctx.Modules.promises.hooks.fire
            .withArgs('getAdminCapabilities')
            .resolves([])
        })
        expectPermission(permission, false)
      })
      describe('admin with `view-project-content`', function () {
        beforeEach(function (ctx) {
          ctx.user.isAdmin = true
          ctx.settings.adminRolesEnabled = true
          ctx.Modules.promises.hooks.fire
            .withArgs('getAdminCapabilities')
            .resolves([['view-project-content']])
        })
        expectPermission(permission, privilegeLevels.readOnly || false)
      })
      describe('admin with `modify-project`', function () {
        beforeEach(function (ctx) {
          ctx.user.isAdmin = true
          ctx.settings.adminRolesEnabled = true
          ctx.Modules.promises.hooks.fire
            .withArgs('getAdminCapabilities')
            .resolves([
              [
                'view-project-content',
                'view-project-setting',
                'modify-project-content',
                'modify-project-setting',
              ],
            ])
        })
        expectPermission(permission, privilegeLevels.siteAdmin || false)
      })

      describe('when user is owner', function () {
        setupUserPrivilegeLevel(PrivilegeLevels.OWNER)
        expectPermission(permission, privilegeLevels.owner || false)
      })

      describe('when user has read-write access', function () {
        setupUserPrivilegeLevel(PrivilegeLevels.READ_AND_WRITE)
        expectPermission(permission, privilegeLevels.readAndWrite || false)
      })

      describe('when user has review access', function () {
        setupUserPrivilegeLevel(PrivilegeLevels.REVIEW)
        expectPermission(permission, privilegeLevels.review || false)
      })

      describe('when user has read-only access', function () {
        setupUserPrivilegeLevel(PrivilegeLevels.READ_ONLY)
        expectPermission(permission, privilegeLevels.readOnly || false)
      })

      describe('when user has read-write access as the public', function () {
        setupPublicAccessLevel(PublicAccessLevels.READ_AND_WRITE)
        expectPermission(
          permission,
          privilegeLevels.publicReadAndWrite || false
        )
      })

      describe('when user has read-only access as the public', function () {
        setupPublicAccessLevel(PublicAccessLevels.READ_ONLY)
        expectPermission(permission, privilegeLevels.publicReadOnly || false)
      })

      describe('when user is not found', function () {
        it('should return false', async function (ctx) {
          const otherUserId = new ObjectId()
          const value = await ctx.AuthorizationManager.promises[permission](
            otherUserId,
            ctx.project._id,
            ctx.token
          )
          expect(value).to.equal(false)
        })
      })
    })

    describe('when anonymous', function () {
      beforeEach(function (ctx) {
        ctx.user = null
      })

      describe('with read-write access through a token', function () {
        setupTokenAccessLevel('readAndWrite')
        expectPermission(permission, privilegeLevels.tokenReadAndWrite || false)
      })

      describe('with read-only access through a token', function () {
        setupTokenAccessLevel('readOnly')
        expectPermission(permission, privilegeLevels.tokenReadOnly || false)
      })

      describe('with public read-write access', function () {
        setupPublicAccessLevel(PublicAccessLevels.READ_AND_WRITE)
        expectPermission(
          permission,
          privilegeLevels.publicReadAndWrite || false
        )
      })

      describe('with public read-only access', function () {
        setupPublicAccessLevel(PublicAccessLevels.READ_ONLY)
        expectPermission(permission, privilegeLevels.publicReadOnly || false)
      })
    })
  })
}

function setupUserPrivilegeLevel(privilegeLevel) {
  beforeEach(function (ctx) {
    ctx.annotate(`set user privilege level to ${privilegeLevel}`)
    ctx.CollaboratorsGetter.promises.getProjectAccess
      .withArgs(ctx.project._id)
      .resolves({
        publicAccessLevel: sinon.stub().returns(PublicAccessLevels.PRIVATE),
        privilegeLevelForUser: sinon
          .stub()
          .withArgs(ctx.user._id)
          .returns(privilegeLevel),
      })
  })
}

function setupPublicAccessLevel(level) {
  beforeEach(function (ctx) {
    ctx.annotate(`set public access level to ${level}`)
    ctx.project.publicAccesLevel = level
    ctx.CollaboratorsGetter.promises.getProjectAccess
      .withArgs(ctx.project._id)
      .resolves({
        publicAccessLevel: sinon.stub().returns(ctx.project.publicAccesLevel),
        privilegeLevelForUser: sinon.stub().returns(PrivilegeLevels.NONE),
      })
  })
}

function setupTokenAccessLevel(level) {
  beforeEach(function (ctx) {
    ctx.annotate(`set token access level to ${level}`)
    ctx.project.publicAccesLevel = PublicAccessLevels.TOKEN_BASED
    ctx.TokenAccessHandler.promises.validateTokenForAnonymousAccess
      .withArgs(ctx.project._id, ctx.token)
      .resolves({
        isValidReadAndWrite: level === 'readAndWrite',
        isValidReadOnly: level === 'readOnly',
      })
  })
}

function expectPermission(permission, expectedValue) {
  it(`should return ${expectedValue}`, async function (ctx) {
    const value = await ctx.AuthorizationManager.promises[permission](
      ctx.user && ctx.user._id,
      ctx.project._id,
      ctx.token
    )
    expect(value).to.equal(expectedValue)
  })
}
