import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'

describe('HttpController', function () {
  beforeEach(async function () {
    const now = Date.now()

    this.contacts = {
      'user-id-1': { n: 2, ts: new Date(now) },
      'user-id-2': { n: 4, ts: new Date(now) },
      'user-id-3': { n: 2, ts: new Date(now - 1000) },
    }

    this.ContactManager = {
      touchContact: sinon.stub().resolves(),
      getContacts: sinon.stub().resolves(this.contacts),
    }

    this.HttpController = await esmock('../../../app/js/HttpController', {
      '../../../app/js/ContactManager': this.ContactManager,
    })

    this.user_id = 'mock-user-id'
    this.contact_id = 'mock-contact-id'

    this.req = {}
    this.res = {}
    this.res.status = sinon.stub().returns(this.res)
    this.res.end = sinon.stub()
    this.res.json = sinon.stub()
    this.res.send = sinon.stub()
    this.res.sendStatus = sinon.stub()
    this.next = sinon.stub()
  })

  describe('addContact', function () {
    describe('with a valid user_id and contact_id', function () {
      beforeEach(async function () {
        this.req.params = { user_id: this.user_id }
        this.req.body = { contact_id: this.contact_id }
        await this.HttpController.addContact(this.req, this.res, this.next)
      })

      it("should update the contact in the user's contact list", function () {
        expect(this.ContactManager.touchContact).to.be.calledWith(
          this.user_id,
          this.contact_id
        )
      })

      it("should update the user in the contact's contact list", function () {
        expect(this.ContactManager.touchContact).to.be.calledWith(
          this.contact_id,
          this.user_id
        )
      })

      it('should send back a 204 status', function () {
        expect(this.res.sendStatus).to.be.calledWith(204)
      })
    })

    describe('with an invalid contact id', function () {
      beforeEach(async function () {
        this.req.params = { user_id: this.user_id }
        this.req.body = { contact_id: '' }
        await this.HttpController.addContact(this.req, this.res, this.next)
      })

      it('should return 400, Bad Request', function () {
        expect(this.res.status).to.be.calledWith(400)
        expect(this.res.send).to.be.calledWith(
          'contact_id should be a non-blank string'
        )
      })
    })
  })

  describe('getContacts', function () {
    describe('normally', function () {
      beforeEach(async function () {
        this.req.params = { user_id: this.user_id }
        this.req.query = {}
        await this.HttpController.getContacts(this.req, this.res, this.next)
      })

      it('should look up the contacts in mongo', function () {
        expect(this.ContactManager.getContacts).to.be.calledWith(this.user_id)
      })

      it('should return a sorted list of contacts by count and timestamp', function () {
        expect(this.res.json).to.be.calledWith({
          contact_ids: ['user-id-2', 'user-id-1', 'user-id-3'],
        })
      })
    })

    describe('with more contacts than the limit', function () {
      beforeEach(async function () {
        this.req.params = { user_id: this.user_id }
        this.req.query = { limit: 2 }
        await this.HttpController.getContacts(this.req, this.res, this.next)
      })

      it('should return the most commonly used contacts up to the limit', function () {
        expect(this.res.json).to.be.calledWith({
          contact_ids: ['user-id-2', 'user-id-1'],
        })
      })
    })

    describe('without a contact list', function () {
      beforeEach(async function () {
        this.ContactManager.getContacts.resolves(null)

        this.req.params = {}
        this.req.query = {}
        await this.HttpController.getContacts(this.req, this.res, this.next)
      })

      it('should return an empty list', function () {
        expect(this.res.json).to.be.calledWith({ contact_ids: [] })
      })
    })
  })
})
