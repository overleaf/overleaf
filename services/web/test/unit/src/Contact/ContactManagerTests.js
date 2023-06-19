const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../../app/src/Features/Contacts/ContactManager'
const SandboxedModule = require('sandboxed-module')

describe('ContactManager', function () {
  beforeEach(function () {
    this.user_id = 'user-id-123'
    this.contact_id = 'contact-id-123'
    this.contact_ids = ['mock', 'contact_ids']
    this.qs = new URLSearchParams({ limit: 42 })
    this.fetch = sinon.stub()
    this.ContactManager = SandboxedModule.require(modulePath, {
      requires: {
        'node-fetch': this.fetch,
        '@overleaf/settings': (this.settings = {
          apis: {
            contacts: {
              url: 'http://contacts.sharelatex.com',
            },
          },
        }),
      },
    })
  })

  describe('getContacts', function () {
    describe('with a successful response code', function () {
      beforeEach(async function () {
        this.response = {
          ok: true,
          json: sinon.stub().resolves({ contact_ids: this.contact_ids }),
        }
        this.fetch.resolves(this.response)

        this.result = await this.ContactManager.promises.getContactIds(
          this.user_id,
          { limit: 42 }
        )
      })

      it('should get the contacts from the contacts api', function () {
        this.fetch.should.have.been.calledWithMatch(
          `${this.settings.apis.contacts.url}/user/${this.user_id}/contacts?${this.qs}`,
          sinon.match({
            method: 'GET',
            headers: { Accept: 'application/json' },
          })
        )
      })

      it('should return the contacts', function () {
        this.result.should.equal(this.contact_ids)
      })
    })

    describe('with a failed response code', function () {
      beforeEach(async function () {
        this.response = {
          ok: false,
          statusCode: 500,
          json: sinon.stub().resolves({ contact_ids: this.contact_ids }),
        }
        this.fetch.resolves(this.response)
      })

      it('should reject the promise', async function () {
        await expect(
          this.ContactManager.promises.getContactIds(this.user_id, {
            limit: 42,
          })
        ).to.be.rejectedWith(
          'contacts api responded with non-success code: 500'
        )
      })
    })
  })

  describe('addContact', function () {
    describe('with a successful response code', function () {
      beforeEach(async function () {
        this.response = {
          ok: true,
          json: sinon.stub().resolves({ contact_ids: this.contact_ids }),
        }
        this.fetch.resolves(this.response)

        this.result = await this.ContactManager.promises.addContact(
          this.user_id,
          this.contact_id
        )
      })

      it('should add the contacts for the user in the contacts api', function () {
        this.fetch.should.have.been.calledWithMatch(
          `${this.settings.apis.contacts.url}/user/${this.user_id}/contacts`,
          sinon.match({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              contact_id: this.contact_id,
            }),
          })
        )
      })

      it('should call the callback', function () {
        this.result.should.equal(this.contact_ids)
      })
    })
  })
})
