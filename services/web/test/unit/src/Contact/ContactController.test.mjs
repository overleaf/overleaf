import { expect, vi } from 'vitest'
import sinon from 'sinon'
import MockResponse from '../helpers/MockResponse.mjs'
const modulePath = '../../../../app/src/Features/Contacts/ContactController.mjs'

describe('ContactController', function () {
  beforeEach(async function (ctx) {
    ctx.SessionManager = { getLoggedInUserId: sinon.stub() }

    vi.doMock('../../../../app/src/Features/User/UserGetter', () => ({
      default: (ctx.UserGetter = {
        promises: {},
      }),
    }))

    vi.doMock('../../../../app/src/Features/Contacts/ContactManager', () => ({
      default: (ctx.ContactManager = { promises: {} }),
    }))

    vi.doMock(
      '../../../../app/src/Features/Authentication/SessionManager',
      () => ({
        default: (ctx.SessionManager = {}),
      })
    )

    vi.doMock('../../../../app/src/infrastructure/Modules', () => ({
      default: (ctx.Modules = {
        promises: { hooks: {} },
      }),
    }))

    ctx.ContactController = (await import(modulePath)).default

    ctx.req = {}
    ctx.res = new MockResponse(vi)
  })

  describe('getContacts', function () {
    beforeEach(function (ctx) {
      ctx.user_id = 'mock-user-id'
      ctx.contact_ids = ['contact-1', 'contact-2', 'contact-3']
      ctx.contacts = [
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
      ctx.SessionManager.getLoggedInUserId = sinon.stub().returns(ctx.user_id)
      ctx.ContactManager.promises.getContactIds = sinon
        .stub()
        .resolves(ctx.contact_ids)
      ctx.UserGetter.promises.getUsers = sinon.stub().resolves(ctx.contacts)
      ctx.Modules.promises.hooks.fire = sinon.stub()
    })

    it('should look up the logged in user id', async function (ctx) {
      ctx.ContactController.getContacts(ctx.req, ctx.res)
      ctx.SessionManager.getLoggedInUserId
        .calledWith(ctx.req.session)
        .should.equal(true)
    })

    it('should get the users contact ids', async function (ctx) {
      ctx.res.callback = () => {
        expect(
          ctx.ContactManager.promises.getContactIds
        ).to.have.been.calledWith(ctx.user_id, { limit: 50 })
      }
      ctx.ContactController.getContacts(ctx.req, ctx.res)
    })

    it('should populate the users contacts ids', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.UserGetter.promises.getUsers).to.have.been.calledWith(
            ctx.contact_ids,
            {
              email: 1,
              first_name: 1,
              last_name: 1,
              holdingAccount: 1,
            }
          )
          resolve()
        }
        ctx.ContactController.getContacts(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should fire the getContact module hook', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          expect(ctx.Modules.promises.hooks.fire).to.have.been.calledWith(
            'getContacts',
            ctx.user_id
          )
          resolve()
        }
        ctx.ContactController.getContacts(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })

    it('should return a formatted list of contacts in contact list order, without holding accounts', async function (ctx) {
      await new Promise((resolve, reject) => {
        ctx.res.callback = () => {
          ctx.res.json.mock.calls[0][0].contacts.should.deep.equal([
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
          resolve()
        }
        ctx.ContactController.getContacts(
          ctx.req,
          ctx.res,
          ctx.rejectOnError(reject)
        )
      })
    })
  })
})
