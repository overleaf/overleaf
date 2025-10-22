const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Contacts/ContactManager'
const SandboxedModule = require('sandboxed-module')

describe('ContactManager', function () {
  beforeEach(function () {
    this.user_id = 'user-id-123'
    this.contact_id = 'contact-id-123'
    this.contact_ids = ['mock', 'contact_ids']
    this.FetchUtils = {
      fetchJson: sinon.stub(),
    }
    this.ContactManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/fetch-utils': this.FetchUtils,
        '@overleaf/settings': (this.settings = {
          apis: {
            contacts: {
              url: 'http://contacts.overleaf.com',
            },
          },
        }),
      },
    })
  })

  describe('getContacts', function () {
    describe('with a successful response code', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchJson.resolves({ contact_ids: this.contact_ids })

        this.result = await this.ContactManager.promises.getContactIds(
          this.user_id,
          { limit: 42 }
        )
      })

      it('should get the contacts from the contacts api', function () {
        this.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          sinon.match(
            url =>
              url.toString() ===
              `${this.settings.apis.contacts.url}/user/${this.user_id}/contacts?limit=42`
          )
        )
      })

      it('should return the contacts', function () {
        this.result.should.equal(this.contact_ids)
      })
    })

    describe('when an error occurs', function () {
      beforeEach(async function () {
        this.response = {
          ok: false,
          statusCode: 500,
          json: sinon.stub().resolves({ contact_ids: this.contact_ids }),
        }
        this.FetchUtils.fetchJson.rejects(new Error('request error'))
      })

      it('should reject the promise', async function () {
        await expect(
          this.ContactManager.promises.getContactIds(this.user_id, {
            limit: 42,
          })
        ).to.be.rejected
      })
    })
  })

  describe('addContact', function () {
    describe('with a successful response code', function () {
      beforeEach(async function () {
        this.FetchUtils.fetchJson.resolves({ contact_ids: this.contact_ids })

        this.result = await this.ContactManager.promises.addContact(
          this.user_id,
          this.contact_id
        )
      })

      it('should add the contacts for the user in the contacts api', function () {
        this.FetchUtils.fetchJson.should.have.been.calledWithMatch(
          sinon.match(
            url =>
              url.toString() ===
              `${this.settings.apis.contacts.url}/user/${this.user_id}/contacts`
          ),
          sinon.match({
            method: 'POST',
            json: { contact_id: this.contact_id },
          })
        )
      })

      it('should call the callback', function () {
        this.result.should.equal(this.contact_ids)
      })
    })
  })
})
