/* eslint-disable
    mocha/no-pending-tests,
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
const { expect } = chai
const modulePath = '../../../app/js/HttpController.js'
const SandboxedModule = require('sandboxed-module')

describe('HttpController', function () {
  beforeEach(function () {
    this.HttpController = SandboxedModule.require(modulePath, {
      requires: {
        './ContactManager': (this.ContactManager = {}),
      },
    })
    this.user_id = 'mock-user-id'
    this.contact_id = 'mock-contact-id'

    this.req = {}
    this.res = {}
    this.res.status = sinon.stub().returns(this.res)
    this.res.end = sinon.stub()
    this.res.send = sinon.stub()
    this.res.sendStatus = sinon.stub()
    return (this.next = sinon.stub())
  })

  describe('addContact', function () {
    beforeEach(function () {
      this.req.params = { user_id: this.user_id }
      return (this.ContactManager.touchContact = sinon.stub().callsArg(2))
    })

    describe('with a valid user_id and contact_id', function () {
      beforeEach(function () {
        this.req.body = { contact_id: this.contact_id }
        return this.HttpController.addContact(this.req, this.res, this.next)
      })

      it("should update the contact in the user's contact list", function () {
        return this.ContactManager.touchContact
          .calledWith(this.user_id, this.contact_id)
          .should.equal(true)
      })

      it("should update the user in the contact's contact list", function () {
        return this.ContactManager.touchContact
          .calledWith(this.contact_id, this.user_id)
          .should.equal(true)
      })

      return it('should send back a 204 status', function () {
        this.res.sendStatus.calledWith(204).should.equal(true)
      })
    })

    return describe('with an invalid contact id', function () {
      beforeEach(function () {
        this.req.body = { contact_id: '' }
        return this.HttpController.addContact(this.req, this.res, this.next)
      })

      return it('should return 400, Bad Request', function () {
        this.res.status.calledWith(400).should.equal(true)
        return this.res.send
          .calledWith('contact_id should be a non-blank string')
          .should.equal(true)
      })
    })
  })

  return describe('getContacts', function () {
    beforeEach(function () {
      this.req.params = { user_id: this.user_id }
      const now = Date.now()
      this.contacts = {
        'user-id-1': { n: 2, ts: new Date(now) },
        'user-id-2': { n: 4, ts: new Date(now) },
        'user-id-3': { n: 2, ts: new Date(now - 1000) },
      }
      return (this.ContactManager.getContacts = sinon
        .stub()
        .callsArgWith(1, null, this.contacts))
    })

    describe('normally', function () {
      beforeEach(function () {
        return this.HttpController.getContacts(this.req, this.res, this.next)
      })

      it('should look up the contacts in mongo', function () {
        return this.ContactManager.getContacts
          .calledWith(this.user_id)
          .should.equal(true)
      })

      return it('should return a sorted list of contacts by count and timestamp', function () {
        return this.res.send
          .calledWith({
            contact_ids: ['user-id-2', 'user-id-1', 'user-id-3'],
          })
          .should.equal(true)
      })
    })

    describe('with more contacts than the limit', function () {
      beforeEach(function () {
        this.req.query = { limit: 2 }
        return this.HttpController.getContacts(this.req, this.res, this.next)
      })

      return it('should return the most commonly used contacts up to the limit', function () {
        return this.res.send
          .calledWith({
            contact_ids: ['user-id-2', 'user-id-1'],
          })
          .should.equal(true)
      })
    })

    describe('without a contact list', function () {
      beforeEach(function () {
        this.ContactManager.getContacts = sinon
          .stub()
          .callsArgWith(1, null, null)
        return this.HttpController.getContacts(this.req, this.res, this.next)
      })

      return it('should return an empty list', function () {
        return this.res.send
          .calledWith({
            contact_ids: [],
          })
          .should.equal(true)
      })
    })
  })
})
