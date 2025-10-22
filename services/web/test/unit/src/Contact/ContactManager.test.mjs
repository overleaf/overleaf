import { vi, expect } from 'vitest'
import sinon from 'sinon'
const modulePath = '../../../../app/src/Features/Contacts/ContactManager'

describe('ContactManager', function () {
  beforeEach(async function (ctx) {
    ctx.user_id = 'user-id-123'
    ctx.contact_id = 'contact-id-123'
    ctx.contact_ids = ['mock', 'contact_ids']
    ctx.FetchUtils = {
      fetchJson: sinon.stub(),
    }

    vi.doMock('@overleaf/fetch-utils', () => ctx.FetchUtils)

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: {
          contacts: {
            url: 'http://contacts.overleaf.com',
          },
        },
      }),
    }))

    ctx.ContactManager = (await import(modulePath)).default
  })

  describe('getContacts', function () {
    describe('with a successful response code', function () {
      beforeEach(async function (ctx) {
        ctx.FetchUtils.fetchJson.resolves({ contact_ids: ctx.contact_ids })

        ctx.result = await ctx.ContactManager.promises.getContactIds(
          ctx.user_id,
          { limit: 42 }
        )
      })

      it('should get the contacts from the contacts api', function (ctx) {
        ctx.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.settings.apis.contacts.url}/user/${ctx.user_id}/contacts?limit=42`
          )
        )
      })

      it('should return the contacts', function (ctx) {
        ctx.result.should.equal(ctx.contact_ids)
      })
    })

    describe('when an error occurs', function () {
      beforeEach(async function (ctx) {
        ctx.response = {
          ok: false,
          statusCode: 500,
          json: sinon.stub().resolves({ contact_ids: ctx.contact_ids }),
        }
        ctx.FetchUtils.fetchJson.rejects(new Error('request error'))
      })

      it('should reject the promise', async function (ctx) {
        await expect(
          ctx.ContactManager.promises.getContactIds(ctx.user_id, {
            limit: 42,
          })
        ).to.be.rejected
      })
    })
  })

  describe('addContact', function () {
    describe('with a successful response code', function () {
      beforeEach(async function (ctx) {
        ctx.FetchUtils.fetchJson.resolves({ contact_ids: ctx.contact_ids })

        ctx.result = await ctx.ContactManager.promises.addContact(
          ctx.user_id,
          ctx.contact_id
        )
      })

      it('should add the contacts for the user in the contacts api', function (ctx) {
        ctx.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          sinon.match(
            url =>
              url.toString() ===
              `${ctx.settings.apis.contacts.url}/user/${ctx.user_id}/contacts`
          ),
          sinon.match({
            method: 'POST',
            json: { contact_id: ctx.contact_id },
          })
        )
      })

      it('should call the callback', function (ctx) {
        ctx.result.should.equal(ctx.contact_ids)
      })
    })
  })
})
