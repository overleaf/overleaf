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
      _id: 'user-id'
    }
    this.SAMLIdentityManager = SandboxedModule.require(modulePath, {
      requires: {
        '../Errors/Errors': this.Errors,
        '../../models/User': {
          User: (this.User = {
            findOne: sinon.stub()
          })
        },
        '../User/UserGetter': (this.UserGetter = {
          getUser: sinon.stub(),
          promises: {
            getUser: sinon.stub().resolves()
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
})
