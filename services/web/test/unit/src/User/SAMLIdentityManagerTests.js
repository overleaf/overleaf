const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../../app/src/Features/User/SAMLIdentityManager.js'

describe('SAMLIdentityManager', function() {
  const linkedEmail = 'another@example.com'

  beforeEach(function() {
    this.Errors = {
      EmailExistsError: sinon.stub(),
      NotFoundError: sinon.stub(),
      SAMLIdentityExistsError: sinon.stub()
    }
    this.userId = 'user-id-1'
    this.user = {
      _id: this.userId,
      email: 'not-linked@overleaf.com',
      emails: [{ email: 'not-linked@overleaf.com' }],
      samlIdentifiers: []
    }
    this.auditLog = {
      initiatorId: this.userId,
      ipAddress: '0:0:0:0'
    }
    this.userAlreadyLinked = {
      _id: 'user-id-2',
      email: 'linked@overleaf.com',
      emails: [{ email: 'linked@overleaf.com', samlProviderId: '1' }],
      samlIdentifiers: [{ externalUserId: 'linked-id', providerId: '1' }]
    }
    this.userEmailExists = {
      _id: 'user-id-3',
      email: 'exists@overleaf.com',
      emails: [{ email: 'exists@overleaf.com' }],
      samlIdentifiers: []
    }
    this.institution = {
      name: 'Overleaf University'
    }
    this.InstitutionsAPI = {
      promises: {
        addEntitlement: sinon.stub().resolves(),
        removeEntitlement: sinon.stub().resolves()
      }
    }
    this.logger = {
      error: sinon.stub(),
      warn: sinon.stub()
    }
    this.SAMLIdentityManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../Email/EmailHandler': (this.EmailHandler = {
          sendEmail: sinon.stub().yields()
        }),
        '../Errors/Errors': this.Errors,
        '../Notifications/NotificationsBuilder': (this.NotificationsBuilder = {
          promises: {
            redundantPersonalSubscription: sinon
              .stub()
              .returns({ create: sinon.stub().resolves() })
          }
        }),
        '../Subscription/SubscriptionLocator': (this.SubscriptionLocator = {
          promises: {
            getUserIndividualSubscription: sinon.stub().resolves()
          }
        }),
        '../../models/User': {
          User: (this.User = {
            findOneAndUpdate: sinon.stub().returns({
              exec: sinon.stub().resolves()
            }),
            findOne: sinon.stub().returns({
              exec: sinon.stub().resolves()
            }),
            update: sinon.stub().returns({
              exec: sinon.stub().resolves()
            })
          })
        },
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves()
          }
        }),
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub(),
          promises: {
            getUser: sinon.stub().resolves(this.user),
            getUserByAnyEmail: sinon.stub().resolves()
          }
        }),
        '../User/UserUpdater': (this.UserUpdater = {
          addEmailAddress: sinon.stub(),
          promises: {
            addEmailAddress: sinon.stub().resolves(),
            confirmEmail: sinon.stub().resolves(),
            updateUser: sinon.stub().resolves()
          }
        }),
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
        'logger-sharelatex': this.logger
      }
    })
  })

  describe('getUser', function() {
    it('should throw an error if missing provider ID and/or external user ID', async function() {
      let error
      try {
        await this.SAMLIdentityManager.getUser(null, null)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.exist
      }
    })
  })

  describe('linkAccounts', function() {
    describe('errors', function() {
      it('should throw an error if missing data', async function() {
        let error
        try {
          await this.SAMLIdentityManager.linkAccounts(
            null,
            null,
            null,
            null,
            null
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
        }
      })

      describe('when email is already associated with another Overleaf account', function() {
        beforeEach(function() {
          this.UserGetter.promises.getUserByAnyEmail.resolves(
            this.userEmailExists
          )
        })

        it('should throw an EmailExistsError error', async function() {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              'user-id-1',
              'not-linked-id',
              'exists@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: 'user-id-1',
                ip: '0:0:0:0'
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(this.Errors.EmailExistsError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when institution identifier is already associated with another Overleaf account', function() {
        beforeEach(function() {
          this.UserGetter.promises.getUserByAnyEmail.resolves(
            this.userAlreadyLinked
          )
        })

        it('should throw an SAMLIdentityExistsError error', async function() {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              'user-id-1',
              'already-linked-id',
              'linked@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: 'user-id-1',
                ip: '0:0:0:0'
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(this.Errors.SAMLIdentityExistsError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      it('should pass back errors via UserAuditLogHandler', async function() {
        let error
        const anError = new Error('oops')
        this.UserAuditLogHandler.promises.addEntry.rejects(anError)
        try {
          await this.SAMLIdentityManager.linkAccounts(
            this.user._id,
            'externalUserId',
            this.user.email,
            '1',
            'Overleaf University',
            undefined,
            {
              intiatorId: 'user-id-1',
              ipAddress: '0:0:0:0'
            }
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
          expect(error).to.equal(anError)
          expect(this.EmailHandler.sendEmail).to.not.have.been.called
          expect(this.User.update).to.not.have.been.called
        }
      })
    })

    describe('success', function() {
      it('should update the user audit log', function() {
        const auditLog = {
          intiatorId: 'user-id-1',
          ip: '0:0:0:0'
        }
        this.SAMLIdentityManager.linkAccounts(
          this.user._id,
          'externalUserId',
          this.user.email,
          '1',
          'Overleaf University',
          undefined,
          auditLog,
          () => {
            expect(
              this.UserAuditLogHandler.promises.addEntry
            ).to.have.been.calledWith(
              this.user._id,
              'link-institution-sso',
              auditLog.initiatorId,
              auditLog.ip,
              {
                institutionEmail: this.user.email,
                providerId: '1',
                providerName: 'Overleaf University'
              }
            )
          }
        )
      })
      it('should send an email notification', function() {
        this.SAMLIdentityManager.linkAccounts(
          this.user._id,
          'externalUserId',
          this.user.email,
          '1',
          'Overleaf University',
          undefined,
          {
            intiatorId: 'user-id-1',
            ipAddress: '0:0:0:0'
          },
          () => {
            expect(this.User.update).to.have.been.called
            expect(this.EmailHandler.sendEmail).to.have.been.calledOnce
            const emailArgs = this.EmailHandler.sendEmail.lastCall.args
            expect(emailArgs[0]).to.equal('securityAlert')
            expect(emailArgs[1].to).to.equal(this.user.email)
            expect(emailArgs[1].actionDescribed).to.contain('was linked')
            expect(emailArgs[1].message[0]).to.contain('Linked')
            expect(emailArgs[1].message[0]).to.contain(this.user.email)
          }
        )
      })
    })
  })

  describe('unlinkAccounts', function() {
    it('should update the audit log', async function() {
      await this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        linkedEmail,
        this.user.email,
        '1',
        'Overleaf University',
        this.auditLog
      )
      expect(
        this.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnce.and.calledWithMatch(
        this.user._id,
        'unlink-institution-sso',
        this.auditLog.initiatorId,
        this.auditLog.ipAddress,
        {
          institutionEmail: linkedEmail,
          providerId: '1',
          providerName: 'Overleaf University'
        }
      )
    })
    it('should remove the identifier', async function() {
      await this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        linkedEmail,
        this.user.email,
        '1',
        'Overleaf University',
        this.auditLog
      )
      const query = {
        _id: this.user._id
      }
      const update = {
        $pull: {
          samlIdentifiers: {
            providerId: '1'
          }
        }
      }
      expect(this.User.update).to.have.been.calledOnce.and.calledWithMatch(
        query,
        update
      )
    })
    it('should send an email notification', async function() {
      await this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        linkedEmail,
        this.user.email,
        '1',
        'Overleaf University',
        this.auditLog
      )
      expect(this.User.update).to.have.been.called
      expect(this.EmailHandler.sendEmail).to.have.been.calledOnce
      const emailArgs = this.EmailHandler.sendEmail.lastCall.args
      expect(emailArgs[0]).to.equal('securityAlert')
      expect(emailArgs[1].to).to.equal(this.user.email)
      expect(emailArgs[1].actionDescribed).to.contain('was unlinked')
      expect(emailArgs[1].message[0]).to.contain('No longer linked')
      expect(emailArgs[1].message[0]).to.contain(linkedEmail)
    })

    describe('errors', function() {
      it('should pass back errors via UserAuditLogHandler', async function() {
        let error
        const anError = new Error('oops')
        this.UserAuditLogHandler.promises.addEntry.rejects(anError)
        try {
          await this.SAMLIdentityManager.unlinkAccounts(
            this.user._id,
            linkedEmail,
            this.user.email,
            '1',
            'Overleaf University',
            this.auditLog
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
          expect(error).to.equal(anError)
          expect(this.EmailHandler.sendEmail).to.not.have.been.called
          expect(this.User.update).to.not.have.been.called
        }
      })
    })
  })

  describe('entitlementAttributeMatches', function() {
    it('should return true when entitlement matches on string', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match on string', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bam'
      ).should.equal(false)
    })

    it('should return false on an invalid matcher', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        '('
      ).should.equal(false)
    })

    it('should log error on an invalid matcher', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches('foo bar', '(')
      this.logger.error.firstCall.args[0].err.message.should.equal(
        'Invalid regular expression: /(/: Unterminated group'
      )
    })

    it('should return true when entitlement matches on array', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match array', function() {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bam'
      ).should.equal(false)
    })
  })

  describe('redundantSubscription', function() {
    const userId = '1bv'
    const providerId = 123
    const providerName = 'University Name'
    describe('with a personal subscription', function() {
      beforeEach(function() {
        this.SubscriptionLocator.promises.getUserIndividualSubscription.resolves(
          {
            planCode: 'professional'
          }
        )
      })
      it('should create redundant personal subscription notification ', async function() {
        try {
          await this.SAMLIdentityManager.redundantSubscription(
            userId,
            providerId,
            providerName
          )
        } catch (error) {
          expect(error).to.not.exist
        }
        expect(this.NotificationsBuilder.promises.redundantPersonalSubscription)
          .to.have.been.calledOnce
      })
    })
    describe('without a personal subscription', function() {
      it('should create redundant personal subscription notification ', async function() {
        try {
          await this.SAMLIdentityManager.redundantSubscription(
            userId,
            providerId,
            providerName
          )
        } catch (error) {
          expect(error).to.not.exist
        }
        expect(this.NotificationsBuilder.promises.redundantPersonalSubscription)
          .to.not.have.been.called
      })
    })
  })
})
