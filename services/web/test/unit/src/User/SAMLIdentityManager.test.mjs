import { vi, expect } from 'vitest'
import mongodb from 'mongodb-legacy'
import sinon from 'sinon'
import Errors from '../../../../app/src/Features/Errors/Errors.js'

const { ObjectId } = mongodb

const modulePath = '../../../../app/src/Features/User/SAMLIdentityManager.mjs'

vi.mock('../../../../app/src/Features/Errors/Errors.js', () =>
  vi.importActual('../../../../app/src/Features/Errors/Errors.js')
)

describe('SAMLIdentityManager', function () {
  const linkedEmail = 'another@example.com'

  beforeEach(async function (ctx) {
    ctx.userId = '6005c75b12cbcaf771f4a105'
    ctx.user = {
      _id: ctx.userId,
      email: 'not-linked@overleaf.com',
      emails: [{ email: 'not-linked@overleaf.com' }],
      samlIdentifiers: [],
    }
    ctx.auditLog = {
      initiatorId: ctx.userId,
      ipAddress: '0:0:0:0',
    }
    ctx.userAlreadyLinked = {
      _id: '6005c7a012cbcaf771f4a106',
      email: 'linked@overleaf.com',
      emails: [{ email: 'linked@overleaf.com', samlProviderId: '1' }],
      samlIdentifiers: [{ externalUserId: 'linked-id', providerId: '1' }],
    }
    ctx.userEmailExists = {
      _id: '6005c7a012cbcaf771f4a107',
      email: 'exists@overleaf.com',
      emails: [{ email: 'exists@overleaf.com' }],
      samlIdentifiers: [],
    }
    ctx.institution = {
      name: 'Overleaf University',
    }
    ctx.InstitutionsAPI = {
      promises: {
        addEntitlement: sinon.stub().resolves(),
        removeEntitlement: sinon.stub().resolves(),
      },
    }

    ctx.logger = {
      error: sinon.stub(),
    }
    vi.doMock('@overleaf/logger', () => ({
      default: ctx.logger,
    }))

    vi.doMock('mongodb-legacy', () => ({
      default: { ObjectId },
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailHandler', () => ({
      default: (ctx.EmailHandler = {
        sendEmail: sinon.stub().yields(),
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Notifications/NotificationsBuilder',
      () => ({
        default: (ctx.NotificationsBuilder = {
          promises: {
            redundantPersonalSubscription: sinon
              .stub()
              .returns({ create: sinon.stub().resolves() }),
          },
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Subscription/SubscriptionLocator',
      () => ({
        default: (ctx.SubscriptionLocator = {
          promises: {
            getUserIndividualSubscription: sinon.stub().resolves(),
          },
        }),
      })
    )

    vi.doMock('../../../../app/src/models/User', () => ({
      User: (ctx.User = {
        findOneAndUpdate: sinon.stub().returns({
          exec: sinon.stub().resolves(ctx.user),
        }),
        findOne: sinon.stub().returns({
          exec: sinon.stub().resolves(),
        }),
        updateOne: sinon.stub().returns({
          exec: sinon.stub().resolves(),
        }),
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserAuditLogHandler', () => ({
      default: (ctx.UserAuditLogHandler = {
        promises: {
          addEntry: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        getUser: sinon.stub(),
        promises: {
          getUser: sinon.stub().resolves(ctx.user),
          getUserByAnyEmail: sinon.stub().resolves(),
          getUserFullEmails: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock('../../../../app/src/Features/User/UserUpdater', () => ({
      default: (ctx.UserUpdater = {
        addEmailAddress: sinon.stub(),
        promises: {
          addEmailAddress: sinon.stub().resolves(),
          confirmEmail: sinon.stub().resolves(),
          updateUser: sinon.stub().resolves(),
        },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Institutions/InstitutionsAPI',
      () => ({
        default: ctx.InstitutionsAPI,
      })
    )

    ctx.SAMLIdentityManager = (await import(modulePath)).default
  })

  describe('getUser', function () {
    it('should throw an error if missing all of: provider ID, external user ID, attribute', async function (ctx) {
      let error
      try {
        await ctx.SAMLIdentityManager.getUser(undefined, undefined, undefined)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.exist
        expect(error.message).to.equal(
          'invalid arguments: providerId: undefined, externalUserId: undefined, userIdAttribute: undefined'
        )
      }
    })
    it('should throw an error if missing provider ID', async function (ctx) {
      let error
      try {
        await ctx.SAMLIdentityManager.getUser(undefined, 'id123', 'someAttr')
      } catch (e) {
        error = e
      } finally {
        expect(error).to.exist
        expect(error.message).to.equal(
          'invalid arguments: providerId: undefined, externalUserId: id123, userIdAttribute: someAttr'
        )
      }
    })
    it('should throw an error if missing external user ID', async function (ctx) {
      let error
      try {
        await ctx.SAMLIdentityManager.getUser('123', null, 'someAttr')
      } catch (e) {
        error = e
      } finally {
        expect(error).to.exist
      }
    })
    it('should throw an error if missing attribute', async function (ctx) {
      let error
      try {
        await ctx.SAMLIdentityManager.getUser('123', 'id123', undefined)
      } catch (e) {
        error = e
      } finally {
        expect(error).to.exist
        expect(error.message).to.equal(
          'invalid arguments: providerId: 123, externalUserId: id123, userIdAttribute: undefined'
        )
      }
    })
  })

  describe('linkAccounts', function () {
    describe('errors', function () {
      beforeEach(function (ctx) {
        // first call is to get userWithProvider; should be falsy
        ctx.UserGetter.promises.getUser.onFirstCall().resolves()
        ctx.UserGetter.promises.getUser.onSecondCall().resolves(ctx.user)
      })

      it('should throw an error if missing all data', async function (ctx) {
        let error
        try {
          await ctx.SAMLIdentityManager.linkAccounts(null, null, null)
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
        }
      })

      describe('linking data', function () {
        const requiredData = {
          externalUserId: 'someUniqueId',
          institutionEmail: 'user@example.com',
          providerId: '123',
          userIdAttribute: 'attribute',
        }
        for (const [data] of Object.entries(requiredData)) {
          const testData = { ...requiredData }
          delete testData[data]
          let error
          it(`should throw an error when missing ${data}`, async function (ctx) {
            try {
              await ctx.SAMLIdentityManager.linkAccounts('123', testData, {})
            } catch (e) {
              error = e
            } finally {
              expect(error).to.exist
              expect(error.message).to.contain(
                'missing data when linking institution SSO'
              )
            }
          })
        }
      })

      describe('when email is already associated with another Overleaf account', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(
            ctx.userEmailExists
          )
        })

        it('should throw an EmailExistsError error', async function (ctx) {
          let error

          try {
            await ctx.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              {
                externalUserId: 'not-linked-id',
                institutionEmail: 'exists@overleaf.com',
                universityId: 'provider-id',
                universityName: 'provider-name',
                hasEntitlement: true,
                userIdAttribute: 'someAttribute',
              },
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.EmailExistsError)
            expect(ctx.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when email is not affiliated', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
          ctx.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'not-affiliated@overleaf.com',
            },
          ])
        })

        it('should throw SAMLEmailNotAffiliatedError', async function (ctx) {
          let error
          try {
            await ctx.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              {
                externalUserId: 'not-linked-id',
                institutionEmail: 'not-affiliated@overleaf.com',
                universityId: 'provider-id',
                universityName: 'provider-name',
                hasEntitlement: true,
                userIdAttribute: 'someAttribute',
              },
              {
                intiatorId: 'user-id-1',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.SAMLEmailNotAffiliatedError)
            expect(ctx.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when email is affiliated with another institution', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(ctx.user)
          ctx.UserGetter.promises.getUserFullEmails.resolves([
            {
              email: 'affiliated@overleaf.com',
              affiliation: { institution: { id: '987' } },
            },
          ])
        })

        it('should throw SAMLEmailAffiliatedWithAnotherInstitutionError', async function (ctx) {
          let error
          try {
            await ctx.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              {
                externalUserId: 'not-linked-id',
                institutionEmail: 'affiliated@overleaf.com',
                universityId: 'provider-id',
                universityName: 'provider-name',
                hasEntitlement: true,
                userIdAttribute: 'someAttribute',
              },
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
            expect(ctx.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when institution identifier is already associated with another Overleaf account', function () {
        beforeEach(function (ctx) {
          ctx.UserGetter.promises.getUserByAnyEmail.resolves(
            ctx.userAlreadyLinked
          )
        })

        it('should throw an SAMLIdentityExistsError error', async function (ctx) {
          let error
          try {
            await ctx.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              {
                externalUserId: 'already-linked-id',
                institutionEmail: 'linked@overleaf.com',
                universityId: 'provider-id',
                universityName: 'provider-name',
                hasEntitlement: true,
                userIdAttribute: 'someAttribute',
              },
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(error).to.be.instanceof(Errors.SAMLIdentityExistsError)
            expect(ctx.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      describe('when institution provider is already associated with the user', function () {
        beforeEach(function (ctx) {
          // first call is to get userWithProvider; resolves with any user
          ctx.UserGetter.promises.getUser.onFirstCall().resolves(ctx.user)
        })

        it('should throw an SAMLAlreadyLinkedError error', async function (ctx) {
          let error
          try {
            await ctx.SAMLIdentityManager.linkAccounts(
              '6005c75b12cbcaf771f4a105',
              {
                externalUserId: 'already-linked-id',
                institutionEmail: 'linked@overleaf.com',
                universityId: 123456,
                universityName: 'provider-name',
                hasEntitlement: true,
                userIdAttribute: 'someAttribute',
              },
              {
                intiatorId: '6005c75b12cbcaf771f4a105',
                ip: '0:0:0:0',
              }
            )
          } catch (e) {
            error = e
          } finally {
            expect(
              ctx.UserGetter.promises.getUser
            ).to.have.been.calledWithMatch({
              _id: new ObjectId('6005c75b12cbcaf771f4a105'),
              'samlIdentifiers.providerId': '123456',
            })
            expect(error).to.be.instanceof(Errors.SAMLAlreadyLinkedError)
            expect(ctx.User.findOneAndUpdate).to.not.have.been.called
          }
        })
      })

      it('should pass back errors via UserAuditLogHandler', async function (ctx) {
        let error
        const anError = new Error('oops')
        ctx.UserAuditLogHandler.promises.addEntry.rejects(anError)
        try {
          await ctx.SAMLIdentityManager.linkAccounts(
            ctx.user._id,
            {
              externalUserId: 'externalUserId',
              institutionEmail: ctx.user.email,
              universityId: '1',
              universityName: 'Overleaf University',
              hasEntitlement: false,
              userIdAttribute: 'someAttribute',
            },
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
          expect(ctx.EmailHandler.sendEmail).to.not.have.been.called
          expect(ctx.User.updateOne).to.not.have.been.called
        }
      })
    })

    describe('success', function () {
      beforeEach(function (ctx) {
        // first call is to get userWithProvider; should be falsy
        ctx.UserGetter.promises.getUser.onFirstCall().resolves()
        ctx.UserGetter.promises.getUser.onSecondCall().resolves(ctx.user)
      })

      it('should update the user audit log', async function (ctx) {
        const auditLog = {
          initiatorId: '6005c75b12cbcaf771f4a105',
          ipAddress: '0:0:0:0',
        }
        await ctx.SAMLIdentityManager.linkAccounts(
          ctx.user._id,
          {
            externalUserId: 'externalUserId',
            institutionEmail: ctx.user.email,
            universityId: '1',
            universityName: 'Overleaf University',
            hasEntitlement: false,
            userIdAttribute: 'uniqueId',
          },
          auditLog
        )

        expect(
          ctx.UserAuditLogHandler.promises.addEntry
        ).to.have.been.calledWith(
          ctx.user._id,
          'link-institution-sso',
          auditLog.initiatorId,
          auditLog.ipAddress,
          {
            institutionEmail: ctx.user.email,
            providerId: '1',
            providerName: 'Overleaf University',
            userIdAttribute: 'uniqueId',
            externalUserId: 'externalUserId',
          }
        )
      })

      it('should send an email notification', async function (ctx) {
        await ctx.SAMLIdentityManager.linkAccounts(
          ctx.user._id,
          {
            externalUserId: 'externalUserId',
            institutionEmail: ctx.user.email,
            universityId: '1',
            universityName: 'Overleaf University',
            hasEntitlement: false,
            userIdAttribute: 'someAttribute',
          },
          {
            intiatorId: '6005c75b12cbcaf771f4a105',
            ipAddress: '0:0:0:0',
          }
        )

        expect(ctx.User.findOneAndUpdate).to.have.been.called
        expect(ctx.EmailHandler.sendEmail).to.have.been.calledOnce
        const emailArgs = ctx.EmailHandler.sendEmail.lastCall.args
        expect(emailArgs[0]).to.equal('securityAlert')
        expect(emailArgs[1].to).to.equal(ctx.user.email)
        expect(emailArgs[1].actionDescribed).to.contain('was linked')
        expect(emailArgs[1].message[0]).to.contain('Linked')
        expect(emailArgs[1].message[0]).to.contain(ctx.user.email)
      })
    })
  })

  describe('unlinkAccounts', function () {
    it('should update the audit log', async function (ctx) {
      await ctx.SAMLIdentityManager.unlinkAccounts(
        ctx.user._id,
        linkedEmail,
        ctx.user.email,
        '1',
        'Overleaf University',
        ctx.auditLog
      )
      expect(
        ctx.UserAuditLogHandler.promises.addEntry
      ).to.have.been.calledOnce.and.calledWithMatch(
        ctx.user._id,
        'unlink-institution-sso',
        ctx.auditLog.initiatorId,
        ctx.auditLog.ipAddress,
        {
          institutionEmail: linkedEmail,
          providerId: '1',
          providerName: 'Overleaf University',
        }
      )
    })
    it('should remove the identifier', async function (ctx) {
      await ctx.SAMLIdentityManager.unlinkAccounts(
        ctx.user._id,
        linkedEmail,
        ctx.user.email,
        '1',
        'Overleaf University',
        ctx.auditLog
      )
      const query = {
        _id: ctx.user._id,
      }
      const update = {
        $pull: {
          samlIdentifiers: {
            providerId: '1',
          },
        },
      }
      expect(ctx.User.updateOne).to.have.been.calledOnce.and.calledWithMatch(
        query,
        update
      )
    })
    it('should send an email notification', async function (ctx) {
      await ctx.SAMLIdentityManager.unlinkAccounts(
        ctx.user._id,
        linkedEmail,
        ctx.user.email,
        '1',
        'Overleaf University',
        ctx.auditLog
      )
      expect(ctx.User.updateOne).to.have.been.called
      expect(ctx.EmailHandler.sendEmail).to.have.been.calledOnce
      const emailArgs = ctx.EmailHandler.sendEmail.lastCall.args
      expect(emailArgs[0]).to.equal('securityAlert')
      expect(emailArgs[1].to).to.equal(ctx.user.email)
      expect(emailArgs[1].actionDescribed).to.contain('was unlinked')
      expect(emailArgs[1].message[0]).to.contain('No longer linked')
      expect(emailArgs[1].message[0]).to.contain(linkedEmail)
    })

    describe('errors', function () {
      it('should pass back errors via UserAuditLogHandler', async function (ctx) {
        let error
        const anError = new Error('oops')
        ctx.UserAuditLogHandler.promises.addEntry.rejects(anError)
        try {
          await ctx.SAMLIdentityManager.unlinkAccounts(
            ctx.user._id,
            linkedEmail,
            ctx.user.email,
            '1',
            'Overleaf University',
            ctx.auditLog
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.exist
          expect(error).to.equal(anError)
          expect(ctx.EmailHandler.sendEmail).to.not.have.been.called
          expect(ctx.User.updateOne).to.not.have.been.called
        }
      })
    })
  })

  describe('entitlementAttributeMatches', function () {
    it('should return true when entitlement matches on string', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match on string', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        'bam'
      ).should.equal(false)
    })

    it('should return false on an invalid matcher', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches(
        'foo bar',
        '('
      ).should.equal(false)
    })

    it('should log error on an invalid matcher', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches('foo bar', '(')
      ctx.logger.error.firstCall.args[0].err.message.should.equal(
        'Invalid regular expression: /(/: Unterminated group'
      )
    })

    it('should return true when entitlement matches on array', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bar'
      ).should.equal(true)
    })

    it('should return false when entitlement does not match array', function (ctx) {
      ctx.SAMLIdentityManager.entitlementAttributeMatches(
        ['foo', 'bar'],
        'bam'
      ).should.equal(false)
    })
  })

  describe('migrateIdentifier', function () {
    const userId = '5efb8b6e9b647b0027e4c0b0'
    const externalUserId = '987zyx'
    const providerId = 123
    const hasEntitlement = false
    const institutionEmail = 'someone@email.com'
    const providerName = 'Example University'
    const auditLog = {
      initiatorId: userId,
      ipAddress: '0.0.0.0',
      migration: {
        from: 'uniqueId',
        to: 'newUniqueId',
      },
    }
    const userIdAttribute = 'newUniqueId'

    it('should remove the old identifier and add the new identifier', async function (ctx) {
      ctx.UserGetter.promises.getUser.resolves()
      ctx.UserGetter.promises.getUserByAnyEmail
        .withArgs(institutionEmail)
        .resolves({ _id: userId, emails: [{ email: institutionEmail }] })
      ctx.UserGetter.promises.getUserFullEmails.withArgs(userId).resolves([
        {
          email: institutionEmail,
          affiliation: { institution: { id: providerId } },
        },
      ])
      await ctx.SAMLIdentityManager.migrateIdentifier(
        userId,
        externalUserId,
        providerId,
        hasEntitlement,
        institutionEmail,
        providerName,
        auditLog,
        userIdAttribute
      )

      expect(ctx.User.updateOne).to.have.been.calledOnce
      const query = {
        _id: userId,
        'samlIdentifiers.providerId': providerId.toString(),
      }

      const update = {
        $set: {
          'samlIdentifiers.$.externalUserId': externalUserId,
          'samlIdentifiers.$.userIdAttribute': userIdAttribute,
        },
      }

      expect(ctx.User.updateOne.lastCall.args).to.deep.equal([query, update])
    })
  })

  describe('unlinkNotMigrated', function () {
    const userId = '5efb8b6e9b647b0027e4c0b0'
    const providerId = '123'
    const institutionEmail = 'someone@email.com'
    const providerName = 'Example University'
    const auditLog = {
      ipAddress: 'N/A',
    }

    it('should remove the identifier om samlIdentifiers and samlProviderId on the email', async function (ctx) {
      ctx.User.findOneAndUpdate = sinon.stub().returns({
        exec: sinon.stub().resolves({
          _id: userId,
          emails: [{ email: institutionEmail, samlProviderId: providerId }],
        }),
      })

      await ctx.SAMLIdentityManager.unlinkNotMigrated(
        userId,
        providerId,
        providerName,
        auditLog
      )

      expect(ctx.User.findOneAndUpdate).to.have.been.calledOnce
      const query = {
        _id: userId,
        'emails.samlProviderId': providerId,
      }
      const update = {
        $pull: {
          samlIdentifiers: {
            providerId,
          },
        },
        $unset: {
          'emails.$.samlProviderId': 1,
        },
      }
      expect(ctx.User.findOneAndUpdate.lastCall.args).to.deep.equal([
        query,
        update,
      ])

      expect(ctx.UserAuditLogHandler.promises.addEntry).to.have.been.calledOnce
      expect(
        ctx.UserAuditLogHandler.promises.addEntry.lastCall.args
      ).to.deep.equal([
        userId,
        'unlink-institution-sso-not-migrated',
        undefined,
        'N/A',
        { providerId, providerName },
      ])

      expect(ctx.InstitutionsAPI.promises.removeEntitlement).to.have.been
        .calledOnce
      expect(
        ctx.InstitutionsAPI.promises.removeEntitlement.lastCall.args
      ).to.deep.equal([userId, institutionEmail])
    })
  })
})
