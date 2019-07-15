/* eslint-disable
    max-len,
    no-dupe-keys,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { assert } = chai
const { expect } = chai
const modulePath = '../../../../app/src/Features/Contacts/ContactController.js'
const SandboxedModule = require('sandboxed-module')

describe('ContactController', function() {
  beforeEach(function() {
    this.AuthenticationController = { getLoggedInUserId: sinon.stub() }
    this.ContactController = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': (this.logger = {
          log: sinon.stub(),
          error: sinon.stub()
        }),
        '../User/UserGetter': (this.UserGetter = {}),
        './ContactManager': (this.ContactManager = {}),
        '../Authentication/AuthenticationController': (this.AuthenticationController = {}),
        '../../infrastructure/Modules': (this.Modules = { hooks: {} }),
        '../Authentication/AuthenticationController': this
          .AuthenticationController
      }
    })

    this.next = sinon.stub()
    this.req = {}
    this.res = {}
    this.res.status = sinon.stub().returns(this.req)
    return (this.res.send = sinon.stub())
  })

  describe('getContacts', function() {
    beforeEach(function() {
      this.user_id = 'mock-user-id'
      this.contact_ids = ['contact-1', 'contact-2', 'contact-3']
      this.contacts = [
        {
          _id: 'contact-1',
          email: 'joe@example.com',
          first_name: 'Joe',
          last_name: 'Example',
          unsued: 'foo'
        },
        {
          _id: 'contact-2',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Example',
          unsued: 'foo',
          holdingAccount: true
        },
        {
          _id: 'contact-3',
          email: 'jim@example.com',
          first_name: 'Jim',
          last_name: 'Example',
          unsued: 'foo'
        }
      ]
      this.AuthenticationController.getLoggedInUserId = sinon
        .stub()
        .returns(this.user_id)
      this.ContactManager.getContactIds = sinon
        .stub()
        .callsArgWith(2, null, this.contact_ids)
      this.UserGetter.getUsers = sinon
        .stub()
        .callsArgWith(2, null, this.contacts)
      this.Modules.hooks.fire = sinon.stub().callsArg(3)

      return this.ContactController.getContacts(this.req, this.res, this.next)
    })

    it('should look up the logged in user id', function() {
      return this.AuthenticationController.getLoggedInUserId
        .calledWith(this.req)
        .should.equal(true)
    })

    it('should get the users contact ids', function() {
      return this.ContactManager.getContactIds
        .calledWith(this.user_id, { limit: 50 })
        .should.equal(true)
    })

    it('should populate the users contacts ids', function() {
      return this.UserGetter.getUsers
        .calledWith(this.contact_ids, {
          email: 1,
          first_name: 1,
          last_name: 1,
          holdingAccount: 1
        })
        .should.equal(true)
    })

    it('should fire the getContact module hook', function() {
      return this.Modules.hooks.fire
        .calledWith('getContacts', this.user_id)
        .should.equal(true)
    })

    it('should return a formatted list of contacts in contact list order, without holding accounts', function() {
      return this.res.send.args[0][0].contacts.should.deep.equal([
        {
          id: 'contact-1',
          email: 'joe@example.com',
          first_name: 'Joe',
          last_name: 'Example',
          type: 'user'
        },
        {
          id: 'contact-3',
          email: 'jim@example.com',
          first_name: 'Jim',
          last_name: 'Example',
          type: 'user'
        }
      ])
    })
  })
})
