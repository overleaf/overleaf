const sinon = require('sinon')
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/Authorization/AuthorizationManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const PrivilegeLevels = require('../../../../app/src/Features/Authorization/PrivilegeLevels')
const PublicAccessLevels = require('../../../../app/src/Features/Authorization/PublicAccessLevels')
const { ObjectId } = require('mongodb-legacy')

describe('AuthorizationManager', function () {
  beforeEach(function () {
    this.user = { _id: new ObjectId() }
    this.project = { _id: new ObjectId() }
    this.doc = { _id: new ObjectId() }
    this.thread = { _id: new ObjectId() }
    this.token = 'some-token'

    this.ProjectGetter = {
      promises: {
        getProject: sinon.stub().resolves(null),
      },
    }
    this.ProjectGetter.promises.getProject
      .withArgs(this.project._id)
      .resolves(this.project)

    this.CollaboratorsGetter = {
      promises: {
        getMemberIdPrivilegeLevel: sinon.stub().resolves(PrivilegeLevels.NONE),
      },
    }

    this.CollaboratorsHandler = {}

    this.User = {
      findOne: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
    }
    this.User.findOne
      .withArgs({ _id: this.user._id })
      .returns({ exec: sinon.stub().resolves(this.user) })

    this.TokenAccessHandler = {
      promises: {
        validateTokenForAnonymousAccess: sinon
          .stub()
          .resolves({ isValidReadAndWrite: false, isValidReadOnly: false }),
      },
    }

    this.DocumentUpdaterHandler = {
      promises: {
        getComment: sinon
          .stub()
          .resolves({ metadata: { user_id: new ObjectId() } }),
      },
    }

    this.AuthorizationManager = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '../Collaborators/CollaboratorsGetter': this.CollaboratorsGetter,
        '../Collaborators/CollaboratorsHandler': this.CollaboratorsHandler,
        '../Project/ProjectGetter': this.ProjectGetter,
        '../../models/User': { User: this.User },
        '../TokenAccess/TokenAccessHandler': this.TokenAccessHandler,
        '../DocumentUpdater/DocumentUpdaterHandler':
          this.DocumentUpdaterHandler,
        '@overleaf/settings': {
          passwordStrengthOptions: {},
          adminPrivilegeAvailable: true,
        },
      },
    })
  })

  describe('isRestrictedUser', function () {
    it('should produce the correct values', function () {
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
          this.AuthorizationManager.isRestrictedUser(...notRestrictedArgs)
        ).to.equal(false)
      }
      for (const restrictedArgs of restrictedScenarios) {
        expect(
          this.AuthorizationManager.isRestrictedUser(...restrictedArgs)
        ).to.equal(true)
      }
    })
  })

  describe('getPrivilegeLevelForProject', function () {
    describe('with a token-based project', function () {
      beforeEach(function () {
        this.project.publicAccesLevel = 'tokenBased'
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function () {
          this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
            .withArgs(this.user._id, this.project._id)
            .resolves(PrivilegeLevels.READ_ONLY)
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it("should return the user's privilege level", function () {
          expect(this.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function () {
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return false', function () {
          expect(this.result).to.equal(false)
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function () {
          this.user.isAdmin = true
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return the user as an owner', function () {
          expect(this.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        describe('when the token is not valid', function () {
          beforeEach(async function () {
            this.result =
              await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                this.project._id,
                this.token
              )
          })

          it('should not call CollaboratorsGetter.getMemberIdPrivilegeLevel', function () {
            this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function () {
            this.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              this.project._id,
              this.token
            )
          })

          it('should return false', function () {
            expect(this.result).to.equal(false)
          })
        })

        describe('when the token is valid for read-and-write', function () {
          beforeEach(async function () {
            this.TokenAccessHandler.promises.validateTokenForAnonymousAccess =
              sinon
                .stub()
                .withArgs(this.project._id, this.token)
                .resolves({ isValidReadAndWrite: true, isValidReadOnly: false })
            this.result =
              await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                this.project._id,
                this.token
              )
          })

          it('should not call CollaboratorsGetter.getMemberIdPrivilegeLevel', function () {
            this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function () {
            this.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              this.project._id,
              this.token
            )
          })

          it('should give read-write access', function () {
            expect(this.result).to.equal('readAndWrite')
          })
        })

        describe('when the token is valid for read-only', function () {
          beforeEach(async function () {
            this.TokenAccessHandler.promises.validateTokenForAnonymousAccess =
              sinon
                .stub()
                .withArgs(this.project._id, this.token)
                .resolves({ isValidReadAndWrite: false, isValidReadOnly: true })
            this.result =
              await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
                null,
                this.project._id,
                this.token
              )
          })

          it('should not call CollaboratorsGetter.getMemberIdPrivilegeLevel', function () {
            this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.called.should.equal(
              false
            )
          })

          it('should check if the token is valid', function () {
            this.TokenAccessHandler.promises.validateTokenForAnonymousAccess.should.have.been.calledWith(
              this.project._id,
              this.token
            )
          })

          it('should give read-only access', function () {
            expect(this.result).to.equal('readOnly')
          })
        })
      })
    })

    describe('with a private project', function () {
      beforeEach(function () {
        this.project.publicAccesLevel = 'private'
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function () {
          this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
            .withArgs(this.user._id, this.project._id)
            .resolves(PrivilegeLevels.READ_ONLY)
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it("should return the user's privilege level", function () {
          expect(this.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function () {
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return false', function () {
          expect(this.result).to.equal(false)
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function () {
          this.user.isAdmin = true
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return the user as an owner', function () {
          expect(this.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        beforeEach(async function () {
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              null,
              this.project._id,
              this.token
            )
        })

        it('should not call CollaboratorsGetter.getMemberIdPrivilegeLevel', function () {
          this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.called.should.equal(
            false
          )
        })

        it('should return false', function () {
          expect(this.result).to.equal(false)
        })
      })
    })

    describe('with a public project', function () {
      beforeEach(function () {
        this.project.publicAccesLevel = 'readAndWrite'
      })

      describe('with a user id with a privilege level', function () {
        beforeEach(async function () {
          this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
            .withArgs(this.user._id, this.project._id)
            .resolves(PrivilegeLevels.READ_ONLY)
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it("should return the user's privilege level", function () {
          expect(this.result).to.equal('readOnly')
        })
      })

      describe('with a user id with no privilege level', function () {
        beforeEach(async function () {
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return the public privilege level', function () {
          expect(this.result).to.equal('readAndWrite')
        })
      })

      describe('with a user id who is an admin', function () {
        beforeEach(async function () {
          this.user.isAdmin = true
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              this.user._id,
              this.project._id,
              this.token
            )
        })

        it('should return the user as an owner', function () {
          expect(this.result).to.equal('owner')
        })
      })

      describe('with no user (anonymous)', function () {
        beforeEach(async function () {
          this.result =
            await this.AuthorizationManager.promises.getPrivilegeLevelForProject(
              null,
              this.project._id,
              this.token
            )
        })

        it('should not call CollaboratorsGetter.getMemberIdPrivilegeLevel', function () {
          this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel.called.should.equal(
            false
          )
        })

        it('should return the public privilege level', function () {
          expect(this.result).to.equal('readAndWrite')
        })
      })
    })

    describe("when the project doesn't exist", function () {
      it('should return a NotFoundError', async function () {
        const someOtherId = new ObjectId()
        await expect(
          this.AuthorizationManager.promises.getPrivilegeLevelForProject(
            this.user._id,
            someOtherId,
            this.token
          )
        ).to.be.rejectedWith(Errors.NotFoundError)
      })
    })

    describe('when the project id is not valid', function () {
      beforeEach(function () {
        this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
          .withArgs(this.user._id, this.project._id)
          .resolves(PrivilegeLevels.READ_ONLY)
      })

      it('should return a error', async function () {
        await expect(
          this.AuthorizationManager.promises.getPrivilegeLevelForProject(
            undefined,
            'not project id',
            this.token
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
      beforeEach(function () {
        this.user.isAdmin = true
      })

      it('should return true', async function () {
        const isAdmin =
          await this.AuthorizationManager.promises.isUserSiteAdmin(
            this.user._id
          )
        expect(isAdmin).to.equal(true)
      })
    })

    describe('when user is not admin', function () {
      it('should return false', async function () {
        const isAdmin =
          await this.AuthorizationManager.promises.isUserSiteAdmin(
            this.user._id
          )
        expect(isAdmin).to.equal(false)
      })
    })

    describe('when user is not found', function () {
      it('should return false', async function () {
        const someOtherId = new ObjectId()
        const isAdmin =
          await this.AuthorizationManager.promises.isUserSiteAdmin(someOtherId)
        expect(isAdmin).to.equal(false)
      })
    })

    describe('when no user is passed', function () {
      it('should return false', async function () {
        const isAdmin =
          await this.AuthorizationManager.promises.isUserSiteAdmin(null)
        expect(isAdmin).to.equal(false)
      })
    })
  })

  describe('canUserDeleteOrResolveThread', function () {
    it('should return true when user has write permissions', async function () {
      this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
        .withArgs(this.user._id, this.project._id)
        .resolves(PrivilegeLevels.READ_AND_WRITE)

      const canResolve =
        await this.AuthorizationManager.promises.canUserDeleteOrResolveThread(
          this.user._id,
          this.project._id,
          this.doc._id,
          this.thread._id,
          this.token
        )

      expect(canResolve).to.equal(true)
    })

    it('should return false when user has read permission', async function () {
      this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
        .withArgs(this.user._id, this.project._id)
        .resolves(PrivilegeLevels.READ_ONLY)

      const canResolve =
        await this.AuthorizationManager.promises.canUserDeleteOrResolveThread(
          this.user._id,
          this.project._id,
          this.doc._id,
          this.thread._id,
          this.token
        )

      expect(canResolve).to.equal(false)
    })

    describe('when user has review permission', function () {
      beforeEach(function () {
        this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
          .withArgs(this.user._id, this.project._id)
          .resolves(PrivilegeLevels.REVIEW)
      })

      it('should return false when user is not the comment author', async function () {
        const canResolve =
          await this.AuthorizationManager.promises.canUserDeleteOrResolveThread(
            this.user._id,
            this.project._id,
            this.doc._id,
            this.thread._id,
            this.token
          )

        expect(canResolve).to.equal(false)
      })

      it('should return true when user is the comment author', async function () {
        this.DocumentUpdaterHandler.promises.getComment
          .withArgs(this.project._id, this.doc._id, this.thread._id)
          .resolves({ metadata: { user_id: this.user._id } })

        const canResolve =
          await this.AuthorizationManager.promises.canUserDeleteOrResolveThread(
            this.user._id,
            this.project._id,
            this.doc._id,
            this.thread._id,
            this.token
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
        beforeEach('set user as site admin', function () {
          this.user.isAdmin = true
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
        it('should return false', async function () {
          const otherUserId = new ObjectId()
          const value = await this.AuthorizationManager.promises[permission](
            otherUserId,
            this.project._id,
            this.token
          )
          expect(value).to.equal(false)
        })
      })
    })

    describe('when anonymous', function () {
      beforeEach(function () {
        this.user = null
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
  beforeEach(`set user privilege level to ${privilegeLevel}`, function () {
    this.CollaboratorsGetter.promises.getMemberIdPrivilegeLevel
      .withArgs(this.user._id, this.project._id)
      .resolves(privilegeLevel)
  })
}

function setupPublicAccessLevel(level) {
  beforeEach(`set public access level to ${level}`, function () {
    this.project.publicAccesLevel = level
  })
}

function setupTokenAccessLevel(level) {
  beforeEach(`set token access level to ${level}`, function () {
    this.project.publicAccesLevel = PublicAccessLevels.TOKEN_BASED
    this.TokenAccessHandler.promises.validateTokenForAnonymousAccess
      .withArgs(this.project._id, this.token)
      .resolves({
        isValidReadAndWrite: level === 'readAndWrite',
        isValidReadOnly: level === 'readOnly',
      })
  })
}

function expectPermission(permission, expectedValue) {
  it(`should return ${expectedValue}`, async function () {
    const value = await this.AuthorizationManager.promises[permission](
      this.user && this.user._id,
      this.project._id,
      this.token
    )
    expect(value).to.equal(expectedValue)
  })
}
