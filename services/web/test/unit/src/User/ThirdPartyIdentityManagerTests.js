const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
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
            addEntry: sinon.stub().yields(),
          }),
        '../../../../app/src/Features/Email/EmailHandler': (this.EmailHandler =
          {
            sendEmail: sinon.stub().yields(),
          }),
        '../../../../app/src/models/User': {
          User: (this.User = {
            findOneAndUpdate: sinon.stub().yields(undefined, this.user),
            findOne: sinon.stub().yields(undefined, undefined),
          }),
        },
        '@overleaf/settings': {
          oauthProviders: {
            google: {
              name: 'Google',
            },
            orcid: {
              name: 'Orcid',
            },
          },
        },
      },
    })
  })
  describe('getUser', function () {
    it('should an error when missing providerId or externalUserId', function (done) {
      this.ThirdPartyIdentityManager.getUser(
        undefined,
        undefined,
        (error, user) => {
          expect(error).to.exist
          expect(error.message).to.equal('invalid SSO arguments')
          expect(error.info).to.deep.equal({
            externalUserId: undefined,
            providerId: undefined,
          })
          done()
        }
      )
    })
    describe('when user linked', function () {
      beforeEach(function () {
        this.User.findOne.yields(undefined, this.user)
      })

      it('should return the user', async function () {
        this.User.findOne.returns(undefined, this.user)
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
      const emailCall = this.EmailHandler.sendEmail.getCall(0)
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
      expect(this.UserAuditLogHandler.addEntry).to.have.been.calledOnceWith(
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
      it('should not unlink if the UserAuditLogHandler throws an error', function (done) {
        this.UserAuditLogHandler.addEntry.yields(anError)
        this.ThirdPartyIdentityManager.link(
          this.userId,
          'google',
          this.externalUserId,
          this.externalData,
          this.auditLog,
          error => {
            expect(error).to.exist
            expect(error).to.equal(anError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
            done()
          }
        )
      })
      describe('EmailHandler', function () {
        beforeEach(function () {
          this.EmailHandler.sendEmail.yields(anError)
        })
        it('should log but not return the error', function (done) {
          this.ThirdPartyIdentityManager.link(
            this.userId,
            'google',
            this.externalUserId,
            this.externalData,
            this.auditLog,
            error => {
              expect(error).to.not.exist
              expect(this.logger.error.lastCall).to.be.calledWithExactly(
                {
                  err: anError,
                  userId: this.userId,
                },
                'could not send security alert email when new account linked'
              )
              done()
            }
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
      const emailCall = this.EmailHandler.sendEmail.getCall(0)
      expect(emailCall.args[0]).to.equal('securityAlert')
      expect(emailCall.args[1].actionDescribed).to.contain(
        'an Orcid account was unlinked from'
      )
    })
    it('should update user audit log', async function () {
      await this.ThirdPartyIdentityManager.promises.unlink(
        this.userId,
        'orcid',
        this.auditLog
      )
      expect(this.UserAuditLogHandler.addEntry).to.have.been.calledOnceWith(
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
      it('should not unlink if the UserAuditLogHandler throws an error', function (done) {
        this.UserAuditLogHandler.addEntry.yields(anError)
        this.ThirdPartyIdentityManager.unlink(
          this.userId,
          'orcid',
          this.auditLog,
          error => {
            expect(error).to.exist
            expect(error).to.equal(anError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
            done()
          }
        )
        expect(this.User.findOneAndUpdate).to.not.have.been.called
      })
      describe('EmailHandler', function () {
        beforeEach(function () {
          this.EmailHandler.sendEmail.yields(anError)
        })
        it('should log but not return the error', function (done) {
          this.ThirdPartyIdentityManager.unlink(
            this.userId,
            'google',
            this.auditLog,
            error => {
              expect(error).to.not.exist
              expect(this.logger.error.lastCall).to.be.calledWithExactly(
                {
                  err: anError,
                  userId: this.userId,
                },
                'could not send security alert email when account no longer linked'
              )
              done()
            }
          )
        })
      })
    })
  })
})
