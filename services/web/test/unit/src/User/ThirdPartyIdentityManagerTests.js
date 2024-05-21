const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const OError = require('@overleaf/o-error')
const modulePath =
  '../../../../app/src/Features/User/ThirdPartyIdentityManager.js'

describe('ThirdPartyIdentityManager', function () {
  beforeEach(function () {
    this.userId = 'a1b2c3'
    this.user = {
      _id: this.userId,
      email: 'example@overleaf.com',
    }
    this.externalUserId = 'id789'
    this.externalData = {}
    this.auditLog = { initiatorId: this.userId, ipAddress: '0:0:0:0' }
    this.ThirdPartyIdentityManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../../../app/src/Features/User/UserAuditLogHandler':
          (this.UserAuditLogHandler = {
            promises: {
              addEntry: sinon.stub().resolves(),
            },
          }),
        '../../../../app/src/Features/Email/EmailHandler': (this.EmailHandler =
          {
            promises: {
              sendEmail: sinon.stub().resolves(),
            },
          }),
        '../../../../app/src/models/User': {
          User: (this.User = {
            findOneAndUpdate: sinon
              .stub()
              .returns({ exec: sinon.stub().resolves(this.user) }),
            findOne: sinon.stub().returns({
              exec: sinon.stub().resolves(undefined),
            }),
          }),
        },
        '@overleaf/settings': {
          oauthProviders: {
            google: {
              name: 'Google',
            },
            orcid: {
              name: 'ORCID',
            },
          },
        },
      },
    })
  })
  describe('getUser', function () {
    it('should throw an error when missing providerId or externalUserId', async function () {
      await expect(
        this.ThirdPartyIdentityManager.promises.getUser(undefined, undefined)
      ).to.be.rejectedWith(OError, `invalid SSO arguments`)
    })

    describe('when user linked', function () {
      beforeEach(function () {
        this.User.findOne.returns({
          exec: sinon.stub().resolves(this.user),
        })
      })

      it('should return the user', async function () {
        this.User.findOne.returns({
          exec: sinon.stub().resolves(this.user),
        })
        const user = await this.ThirdPartyIdentityManager.promises.getUser(
          'google',
          'an-id-linked'
        )
        expect(user).to.deep.equal(this.user)
      })
    })
    it('should return ThirdPartyUserNotFoundError when no user linked', function (done) {
      this.ThirdPartyIdentityManager.getUser(
        'google',
        'an-id-not-linked',
        (error, user) => {
          expect(error).to.exist
          expect(error.name).to.equal('ThirdPartyUserNotFoundError')
          done()
        }
      )
    })
  })
  describe('link', function () {
    it('should send email alert', async function () {
      await this.ThirdPartyIdentityManager.promises.link(
        this.userId,
        'google',
        this.externalUserId,
        this.externalData,
        this.auditLog
      )
      const emailCall = this.EmailHandler.promises.sendEmail.getCall(0)
      expect(emailCall.args[0]).to.equal('securityAlert')
      expect(emailCall.args[1].actionDescribed).to.contain(
        'a Google account was linked'
      )
    })

    it('should update user audit log', async function () {
      await this.ThirdPartyIdentityManager.promises.link(
        this.userId,
        'google',
        this.externalUserId,
        this.externalData,
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnceWith(
        this.userId,
        'link-sso',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          providerId: 'google',
        }
      )
    })
    describe('errors', function () {
      const anError = new Error('oops')

      it('should not unlink if the UserAuditLogHandler throws an error', async function () {
        this.UserAuditLogHandler.promises.addEntry.throws(anError)
        await expect(
          this.ThirdPartyIdentityManager.promises.link(
            this.userId,
            'google',
            this.externalUserId,
            this.externalData,
            this.auditLog
          )
        ).to.be.rejectedWith(anError)
        expect(this.User.findOneAndUpdate).to.not.have.been.called
      })

      describe('EmailHandler', function () {
        beforeEach(function () {
          this.EmailHandler.promises.sendEmail.rejects(anError)
        })
        it('should log but not return the error', async function () {
          await expect(
            this.ThirdPartyIdentityManager.promises.link(
              this.userId,
              'google',
              this.externalUserId,
              this.externalData,
              this.auditLog
            )
          ).to.be.fulfilled
          expect(this.logger.error.lastCall).to.be.calledWithExactly(
            {
              err: anError,
              userId: this.userId,
            },
            'could not send security alert email when new account linked'
          )
        })
      })
    })
  })

  describe('unlink', function () {
    it('should send email alert', async function () {
      await this.ThirdPartyIdentityManager.promises.unlink(
        this.userId,
        'orcid',
        this.auditLog
      )
      const emailCall = this.EmailHandler.promises.sendEmail.getCall(0)
      expect(emailCall.args[0]).to.equal('securityAlert')
      expect(emailCall.args[1].actionDescribed).to.contain(
        'an ORCID account was unlinked from'
      )
    })
    it('should update user audit log', async function () {
      await this.ThirdPartyIdentityManager.promises.unlink(
        this.userId,
        'orcid',
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnceWith(
        this.userId,
        'unlink-sso',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          providerId: 'orcid',
        }
      )
    })

    describe('errors', function () {
      const anError = new Error('oops')

      it('should not unlink if the UserAuditLogHandler throws an error', async function () {
        this.UserAuditLogHandler.promises.addEntry.throws(anError)

        await expect(
          this.ThirdPartyIdentityManager.promises.unlink(
            this.userId,
            'orcid',
            this.auditLog
          )
        ).to.be.rejectedWith(anError)

        expect(this.User.findOneAndUpdate).to.not.have.been.called
      })

      describe('EmailHandler', function () {
        beforeEach(function () {
          this.EmailHandler.promises.sendEmail.rejects(anError)
        })
        it('should log but not return the error', async function () {
          await expect(
            this.ThirdPartyIdentityManager.promises.unlink(
              this.userId,
              'google',
              this.auditLog
            )
          ).to.be.fulfilled

          expect(this.logger.error.lastCall).to.be.calledWithExactly(
            {
              err: anError,
              userId: this.userId,
            },
            'could not send security alert email when account no longer linked'
          )
        })
      })
    })
  })
})
