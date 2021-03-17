/* eslint-disable
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
const modulePath = '../../../app/js/ContactManager.js'
const SandboxedModule = require('sandboxed-module')
const { ObjectId } = require('mongodb')
const tk = require('timekeeper')

describe('ContactManager', function () {
  beforeEach(function () {
    tk.freeze(Date.now())
    this.ContactManager = SandboxedModule.require(modulePath, {
      requires: {
        './mongodb': {
          db: (this.db = { contacts: {} }),
          ObjectId
        }
      }
    })
    this.user_id = ObjectId().toString()
    this.contact_id = ObjectId().toString()
    return (this.callback = sinon.stub())
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('touchContact', function () {
    beforeEach(function () {
      this.db.contacts.updateOne = sinon.stub().callsArg(3)
    })

    describe('with a valid user_id', function () {
      beforeEach(function () {
        return this.ContactManager.touchContact(
          this.user_id,
          (this.contact_id = 'mock_contact'),
          this.callback
        )
      })

      it('should increment the contact count and timestamp', function () {
        this.db.contacts.updateOne
          .calledWith(
            {
              user_id: sinon.match(
                (o) => o.toString() === this.user_id.toString()
              )
            },
            {
              $inc: {
                'contacts.mock_contact.n': 1
              },
              $set: {
                'contacts.mock_contact.ts': new Date()
              }
            },
            {
              upsert: true
            }
          )
          .should.equal(true)
      })

      return it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })
    })

    return describe('with an invalid user id', function () {
      beforeEach(function () {
        return this.ContactManager.touchContact(
          'not-valid-object-id',
          this.contact_id,
          this.callback
        )
      })

      return it('should call the callback with an error', function () {
        return this.callback.calledWith(sinon.match(Error)).should.equal(true)
      })
    })
  })

  return describe('getContacts', function () {
    beforeEach(function () {
      this.user = {
        contacts: ['mock', 'contacts']
      }
      return (this.db.contacts.findOne = sinon
        .stub()
        .callsArgWith(1, null, this.user))
    })

    describe('with a valid user_id', function () {
      beforeEach(function () {
        return this.ContactManager.getContacts(this.user_id, this.callback)
      })

      it("should find the user's contacts", function () {
        return this.db.contacts.findOne
          .calledWith({
            user_id: sinon.match(
              (o) => o.toString() === this.user_id.toString()
            )
          })
          .should.equal(true)
      })

      return it('should call the callback with the contacts', function () {
        return this.callback
          .calledWith(null, this.user.contacts)
          .should.equal(true)
      })
    })

    return describe('with an invalid user id', function () {
      beforeEach(function () {
        return this.ContactManager.getContacts(
          'not-valid-object-id',
          this.callback
        )
      })

      return it('should call the callback with an error', function () {
        return this.callback.calledWith(sinon.match(Error)).should.equal(true)
      })
    })
  })
})
