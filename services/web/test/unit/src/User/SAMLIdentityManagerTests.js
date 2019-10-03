const sinon = require('sinon')
const chai = require('chai')
const { expect } = chai
const SandboxedModule = require('sandboxed-module')
const modulePath = '../../../../app/src/Features/User/SAMLIdentityManager.js'

describe('SAMLIdentityManager', function() {
  beforeEach(function() {
    this.Errors = {
      NotFoundError: sinon.stub(),
      SAMLIdentityExistsError: sinon.stub(),
      SAMLUserNotFoundError: sinon.stub()
    }
    this.user = {
      _id: 'user-id',
      email: 'dev@overleaf.com',
      emails: [
        { email: 'dev@overleaf.com' },
        { email: 'team@overleaf.com', samlProviderId: '1' }
      ],
      samlIdentifiers: [{ providerId: '1' }]
    }
    this.userWithoutInstitutionEmail = {
      _id: 'user-id',
      emails: [{ email: 'dev@overleaf.com' }]
    }
    this.institution = {
      name: 'Overleaf University'
    }
    this.SAMLIdentityManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Email/EmailHandler': (this.EmailHandler = {
          sendEmail: sinon.stub().yields()
        }),
        '../Errors/Errors': this.Errors,
        '../../models/User': {
          User: (this.User = {
            findOne: sinon.stub(this.user),
            update: sinon.stub().returns({
              exec: sinon.stub().resolves()
            })
          })
        },
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub(),
          promises: {
            getUser: sinon.stub().resolves(this.user)
          }
        }),
        '../User/UserUpdater': (this.UserUpdater = {
          addEmailAddress: sinon.stub()
        })
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
})
