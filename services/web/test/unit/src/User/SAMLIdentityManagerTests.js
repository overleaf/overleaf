const { ObjectId } = require('mongodb')
const sinon = require('sinon')
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const modulePath = '../../../../app/src/Features/User/SAMLIdentityManager.js'

describe('SAMLIdentityManager', function () {
  const linkedEmail = 'another@example.com'

  beforeEach(function () {
    this.userId = '6005c75b12cbcaf771f4a105'
    this.user = {
      _id: this.userId,
      email: 'not-linked@overleaf.com',
      emails: [{ email: 'not-linked@overleaf.com' }],
      samlIdentifiers: [],
    }
    this.auditLog = {
      initiatorId: this.userId,
      ipAddress: '0:0:0:0',
    }
    this.userAlreadyLinked = {
      _id: '6005c7a012cbcaf771f4a106',
      email: 'linked@overleaf.com',
      emails: [{ email: 'linked@overleaf.com', samlProviderId: '1' }],
      samlIdentifiers: [{ externalUserId: 'linked-id', providerId: '1' }],
    }
    this.userEmailExists = {
      _id: '6005c7a012cbcaf771f4a107',
      email: 'exists@overleaf.com',
      emails: [{ email: 'exists@overleaf.com' }],
      samlIdentifiers: [],
    }
    this.institution = {
      name: 'Overleaf University',
    }
    this.InstitutionsAPI = {
      promises: {
        addEntitlement: sinon.stub().resolves(),
        removeEntitlement: sinon.stub().resolves(),
      },
    }
    this.SAMLIdentityManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Email/EmailHandler': (this.EmailHandler = {
          sendEmail: sinon.stub().yields(),
        }),
        '../Notifications/NotificationsBuilder': (this.NotificationsBuilder = {
          promises: {
            redundantPersonalSubscription: sinon
              .stub()
              .returns({ create: sinon.stub().resolves() }),
          },
        }),
        '../Subscription/SubscriptionLocator': (this.SubscriptionLocator = {
          promises: {
            getUserIndividualSubscription: sinon.stub().resolves(),
          },
        }),
        '../../models/User': {
          User: (this.User = {
            findOneAndUpdate: sinon.stub().returns({
              exec: sinon.stub().resolves(this.user),
            }),
            findOne: sinon.stub().returns({
              exec: sinon.stub().resolves(),
            }),
            updateOne: sinon.stub().returns({
              exec: sinon.stub().resolves(),
            }),
          }),
        },
        '../User/UserAuditLogHandler': (this.UserAuditLogHandler = {
          promises: {
            addEntry: sinon.stub().resolves(),
          },
        }),
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub(),
          promises: {
            getUser: sinon.stub().resolves(this.user),
            getUserByAnyEmail: sinon.stub().resolves(),
            getUserFullEmails: sinon.stub().resolves(),
          },
        }),
        '../User/UserUpdater': (this.UserUpdater = {
          addEmailAddress: sinon.stub(),
          promises: {
            addEmailAddress: sinon.stub().resolves(),
            confirmEmail: sinon.stub().resolves(),
            updateUser: sinon.stub().resolves(),
          },
        }),
        '../Institutions/InstitutionsAPI': this.InstitutionsAPI,
      },
    })
  })

  describe('getUser', function () {
    it('should throw an error if missing provider ID and/or external user ID', async function () {
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

  describe('linkAccounts', function () {
    describe('errors', function () {
      beforeEach(function () {
        // first call is to get userWithProvider; should be falsy
        this.UserGetter.promises.getUser.onFirstCall().resolves()
        this.UserGetter.promises.getUser.onSecondCall().resolves(this.user)
      })

      it('should throw an error if missing data', async function () {
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

      describe('when email is already associated with another Overleaf account', function () {
        beforeEach(function () {
          this.UserGetter.promises.getUserByAnyEmail.resolves(
            this.userEmailExists
          )
        })

        it('should throw an EmailExistsError error', async function () {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              'not-linked-id',
              'exists@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.EmailExistsError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when email is not affiliated', function () {
        beforeEach(function () {
          this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
          this.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'not-affiliated@overleaf.com',
            },
          ])
        })

        it('should throw SAMLEmailNotAffiliatedError', async function () {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              'not-linked-id',
              'not-affiliated@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: 'user-id-1',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.SAMLEmailNotAffiliatedError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when email is affiliated with another institution', function () {
        beforeEach(function () {
          this.UserGetter.promises.getUserByAnyEmail.resolves(this.user)
          this.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'affiliated@overleaf.com',
              affiliation: { institution: { id: '987' } },
            },
          ])
        })

        it('should throw SAMLEmailAffiliatedWithAnotherInstitutionError', async function () {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              'not-linked-id',
              'affiliated@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: 'user-id-1',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(
              Errors.SAMLEmailAffiliatedWithAnotherInstitutionError
            )
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when institution identifier is already associated with another Overleaf account', function () {
        beforeEach(function () {
          this.UserGetter.promises.getUserByAnyEmail.resolves(
            this.userAlreadyLinked
          )
        })

        it('should throw an SAMLIdentityExistsError error', async function () {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              'already-linked-id',
              'linked@overleaf.com',
              'provider-id',
              'provider-name',
              true,
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.SAMLIdentityExistsError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when institution provider is already associated with the user', function () {
        beforeEach(function () {
          // first call is to get userWithProvider; resolves with any user
          this.UserGetter.promises.getUser.onFirstCall().resolves(this.user)
        })

        it('should throw an SAMLAlreadyLinkedError error', async function () {
          let error
          try {
            await this.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              'already-linked-id',
              'linked@overleaf.com',
              123456,
              'provider-name',
              true,
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(
              this.UserGetter.promises.getUser
            ).to.have.been.calledWithMatch({
              _id: ObjectId('6005c75b12cbcaf771f4a105'),
              'samlIdentifiers.providerId': '123456',
            })
            expect(error).to.be.instanceof(Errors.SAMLAlreadyLinkedError)
            expect(this.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      it('should pass back errors via UserAuditLogHandler', async function () {
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
              intiatorId: '6005c75b12cbcaf771f4a105',
              ipAddress: '0:0:0:0',
            }
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
          expect(error).to.equal(anError)
          expect(this.EmailHandler.sendEmail).to.not.have.been.called
          expect(this.User.updateOne).to.not.have.been.called
        }
      })
    })

    describe('success', function () {
      beforeEach(function () {
        // first call is to get userWithProvider; should be falsy
        this.UserGetter.promises.getUser.onFirstCall().resolves()
        this.UserGetter.promises.getUser.onSecondCall().resolves(this.user)
      })

      it('should update the user audit log', function () {
        const auditLog = {
          intiatorId: '6005c75b12cbcaf771f4a105',
          ip: '0:0:0:0',
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
                providerName: 'Overleaf University',
              }
            )
          }
        )
      })

      it('should send an email notification', function () {
        this.SAMLIdentityManager.linkAccounts(
          this.user._id,
          'externalUserId',
          this.user.email,
          '1',
          'Overleaf University',
          undefined,
          {
            intiatorId: '6005c75b12cbcaf771f4a105',
            ipAddress: '0:0:0:0',
          },
          () => {
            expect(this.User.updateOne).to.have.been.called
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

  describe('unlinkAccounts', function () {
    it('should update the audit log', async function () {
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
          providerName: 'Overleaf University',
        }
      )
    })
    it('should remove the identifier', async function () {
      await this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        linkedEmail,
        this.user.email,
        '1',
        'Overleaf University',
        this.auditLog
      )
      const query = {
        _id: this.user._id,
      }
      const update = {
        $pull: {
          samlIdentifiers: {
            providerId: '1',
          },
        },
      }
      expect(this.User.updateOne).to.have.been.calledOnce.and.calledWithMatch(
        query,
        update
      )
    })
    it('should send an email notification', async function () {
      await this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        linkedEmail,
        this.user.email,
        '1',
        'Overleaf University',
        this.auditLog
      )
      expect(this.User.updateOne).to.have.been.called
      expect(this.EmailHandler.sendEmail).to.have.been.calledOnce
      const emailArgs = this.EmailHandler.sendEmail.lastCall.args
      expect(emailArgs[0]).to.equal('securityAlert')
      expect(emailArgs[1].to).to.equal(this.user.email)
      expect(emailArgs[1].actionDescribed).to.contain('was unlinked')
      expect(emailArgs[1].message[0]).to.contain('No longer linked')
      expect(emailArgs[1].message[0]).to.contain(linkedEmail)
    })

    describe('errors', function () {
      it('should pass back errors via UserAuditLogHandler', async function () {
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
          expect(this.User.updateOne).to.not.have.been.called
        }
      })
    })
  })

  describe('entitlementAttributeMatches', function () {
    it('should return true when entitlement matches on string', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match on string', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bam'
      ).should.equal(false)
    })

    it('should return false on an invalid matcher', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        '('
      ).should.equal(false)
    })

    it('should log error on an invalid matcher', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches('foo bar', '(')
      this.logger.error.firstCall.args[0].err.message.should.equal(
        'Invalid regular expression: /(/: Unterminated group'
      )
    })

    it('should return true when entitlement matches on array', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match array', function () {
      this.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bam'
      ).should.equal(false)
    })
  })

  describe('redundantSubscription', function () {
    const userId = '1bv'
    const providerId = 123
    const providerName = 'University Name'
    describe('with a personal subscription', function () {
      beforeEach(function () {
        this.SubscriptionLocator.promises.getUserIndividualSubscription.resolves(
          {
            planCode: 'professional',
          }
        )
      })
      it('should create redundant personal subscription notification ', async function () {
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
    describe('without a personal subscription', function () {
      it('should create redundant personal subscription notification ', async function () {
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
