import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import MockResponse from '../helpers/MockResponse.js'
const modulePath = '../../../../app/src/Features/Contacts/ContactController.mjs'

describe('ContactController', function () {
  beforeEach(async function () {
    this.SessionManager = { getLoggedInUserId: sinon.stub() }
    this.ContactController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/User/UserGetter': (this.UserGetter = {
        promises: {},
      }),
      '../../../../app/src/Features/Contacts/ContactManager':
        (this.ContactManager = { promises: {} }),
      '../../../../app/src/Features/Authentication/SessionManager':
        (this.SessionManager = {}),
      '../../../../app/src/infrastructure/Modules': (this.Modules = {
        promises: { hooks: {} },
      }),
    })

    this.req = {}
    this.res = new MockResponse()
  })

  describe('getContacts', function () {
    beforeEach(function () {
      this.user_id = 'mock-user-id'
      this.contact_ids = ['contact-1', 'contact-2', 'contact-3']
      this.contacts = [
        {
          _id: 'contact-1',
          email: 'joe@example.com',
          first_name: 'Joe',
          last_name: 'Example',
          unsued: 'foo',
        },
        {
          _id: 'contact-2',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Example',
          unsued: 'foo',
          holdingAccount: true,
        },
        {
          _id: 'contact-3',
          email: 'jim@example.com',
          first_name: 'Jim',
          last_name: 'Example',
          unsued: 'foo',
        },
      ]
      this.SessionManager.getLoggedInUserId = sinon.stub().returns(this.user_id)
      this.ContactManager.promises.getContactIds = sinon
        .stub()
        .resolves(this.contact_ids)
      this.UserGetter.promises.getUsers = sinon.stub().resolves(this.contacts)
      this.Modules.promises.hooks.fire = sinon.stub()
    })

    it('should look up the logged in user id', async function () {
      this.ContactController.getContacts(this.req, this.res)
      this.SessionManager.getLoggedInUserId
        .calledWith(this.req.session)
        .should.equal(true)
    })

    it('should get the users contact ids', async function () {
      this.res.callback = () => {
        expect(
          this.ContactManager.promises.getContactIds
        ).to.have.been.calledWith(this.user_id, { limit: 50 })
      }
      this.ContactController.getContacts(this.req, this.res)
    })

    it('should populate the users contacts ids', function (done) {
      this.res.callback = () => {
        expect(this.UserGetter.promises.getUsers).to.have.been.calledWith(
          this.contact_ids,
          {
            email: 1,
            first_name: 1,
            last_name: 1,
            holdingAccount: 1,
          }
        )
        done()
      }
      this.ContactController.getContacts(this.req, this.res, done)
    })

    it('should fire the getContact module hook', function (done) {
      this.res.callback = () => {
        expect(this.Modules.promises.hooks.fire).to.have.been.calledWith(
          'getContacts',
          this.user_id
        )
        done()
      }
      this.ContactController.getContacts(this.req, this.res, done)
    })

    it('should return a formatted list of contacts in contact list order, without holding accounts', function (done) {
      this.res.callback = () => {
        this.res.json.args[0][0].contacts.should.deep.equal([
          {
            id: 'contact-1',
            email: 'joe@example.com',
            first_name: 'Joe',
            last_name: 'Example',
            type: 'user',
          },
          {
            id: 'contact-3',
            email: 'jim@example.com',
            first_name: 'Jim',
            last_name: 'Example',
            type: 'user',
          },
        ])
        done()
      }
      this.ContactController.getContacts(this.req, this.res, done)
    })
  })
})
