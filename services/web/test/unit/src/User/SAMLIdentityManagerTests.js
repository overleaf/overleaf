const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../../app/src/Features/User/SAMLIdentityManager.js'

describe('SAMLIdentityManager', function() {
  beforeEach(function() {
    this.Errors = {
      EmailExistsError: sinon.stub(),
      NotFoundError: sinon.stub(),
      SAMLIdentityExistsError: sinon.stub(),
      SAMLUserNotFoundError: sinon.stub()
    }
    this.user = {
      _id: 'user-id-1',
      email: 'not-linked@overleaf.com',
      emails: [{ email: 'not-linked@overleaf.com' }],
      samlIdentifiers: []
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
      requires: {
        '../Email/EmailHandler': (this.EmailHandler = {
          sendEmail: sinon.stub().yields()
        }),
        '../Errors/Errors': this.Errors,
        '../../models/User': {
          User: (this.User = {
            findOneAndUpdate: sinon.stub(),
            findOne: sinon.stub().returns({
              exec: sinon.stub().resolves()
            }),
            update: sinon.stub().returns({
              exec: sinon.stub().resolves()
            })
          })
        },
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub(),
          promises: {
            getUser: sinon.stub().resolves(this.user),
            getUserByAnyEmail: sinon.stub().resolves()
          }
        }),
        '../User/UserUpdater': (this.UserUpdater = {
          addEmailAddress: sinon.stub()
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
    it('should throw an error if missing data', async function() {
      let error
      try {
        await this.SAMLIdentityManager.linkAccounts(null, null, null, null)
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
            true
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
            true
          )
        } catch (e) {
          error = e
        } finally {
          expect(error).to.be.instanceof(this.Errors.SAMLIdentityExistsError)
          expect(this.User.findOneAndUpdate).to.not.have.been.called
        }
      })
    })
  })

  describe('unlinkAccounts', function() {
    it('should send an email notification email', function() {
      this.SAMLIdentityManager.unlinkAccounts(
        this.user._id,
        this.user.email,
        '1',
        'Overleaf University',
        () => {
          expect(this.User.update).to.have.been.called
          expect(this.EmailHandler.sendEmail).to.have.been.called
        }
      )
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
})
