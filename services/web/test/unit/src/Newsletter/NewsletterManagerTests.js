const { expect } = require('chai')
const sinon = require('sinon')
const { RequestFailedError } = require('@overleaf/fetch-utils')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/Features/Newsletter/NewsletterManager'

describe('NewsletterManager', function () {
  beforeEach('setup mocks', function () {
    this.Settings = {
      mailchimp: {
        api_key: 'api_key',
        list_id: 'list_id',
      },
    }
    this.mailchimp = {
      get: sinon.stub(),
      put: sinon.stub(),
      patch: sinon.stub(),
      delete: sinon.stub(),
    }
    this.Mailchimp = sinon.stub().returns(this.mailchimp)

    this.mergeFields = {
      FNAME: 'Overleaf',
      LNAME: 'Duck',
      MONGO_ID: 'user_id',
    }

    this.NewsletterManager = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './MailChimpClient': this.Mailchimp,
        '@overleaf/settings': this.Settings,
      },
      globals: { AbortController },
    }).promises

    this.NewsletterManager.get = sinon.stub()
    this.NewsletterManager.delete = sinon.stub()

    this.user = {
      _id: 'user_id',
      email: 'overleaf.duck@example.com',
      first_name: 'Overleaf',
      last_name: 'Duck',
    }
    // MD5 sum of the user email
    this.emailHash = 'c02f60ed0ef51818186274e406c9a48f'
  })

  describe('subscribed', function () {
    it('calls Mailchimp to get the user status', async function () {
      await this.NewsletterManager.subscribed(this.user)
      expect(this.mailchimp.get).to.have.been.calledWith(
        `/lists/list_id/members/${this.emailHash}`
      )
    })

    it('returns true when subscribed', async function () {
      this.mailchimp.get.resolves({ status: 'subscribed' })

      const subscribed = await this.NewsletterManager.subscribed(this.user)
      expect(subscribed).to.be.true
    })

    it('returns false on 404', async function () {
      this.mailchimp.get.rejects(
        new RequestFailedError(
          'http://some-url',
          {},
          { status: 404 },
          'Not found'
        )
      )
      const subscribed = await this.NewsletterManager.subscribed(this.user)
      expect(subscribed).to.be.false
    })
  })

  describe('subscribe', function () {
    it('calls Mailchimp to subscribe the user', async function () {
      await this.NewsletterManager.subscribe(this.user)
      expect(this.mailchimp.put).to.have.been.calledWith(
        `/lists/list_id/members/${this.emailHash}`,
        {
          email_address: this.user.email,
          status: 'subscribed',
          status_if_new: 'subscribed',
          merge_fields: this.mergeFields,
        }
      )
    })
  })

  describe('unsubscribe', function () {
    describe('when unsubscribing normally', function () {
      it('calls Mailchimp to unsubscribe the user', async function () {
        await this.NewsletterManager.unsubscribe(this.user)
        expect(this.mailchimp.patch).to.have.been.calledWith(
          `/lists/list_id/members/${this.emailHash}`,
          {
            status: 'unsubscribed',
            merge_fields: this.mergeFields,
          }
        )
      })

      it('ignores a Mailchimp error about fake emails', async function () {
        this.mailchimp.patch.rejects(
          new Error(
            'overleaf.duck@example.com looks fake or invalid, please enter a real email address'
          )
        )
        await expect(this.NewsletterManager.unsubscribe(this.user)).to.be
          .fulfilled
      })

      it('rejects on other errors', async function () {
        this.mailchimp.patch.rejects(
          new Error('something really wrong is happening')
        )
        await expect(this.NewsletterManager.unsubscribe(this.user)).to.be
          .rejected
      })
    })

    describe('when deleting', function () {
      it('calls Mailchimp to delete the user', async function () {
        await this.NewsletterManager.unsubscribe(this.user, { delete: true })
        expect(this.mailchimp.delete).to.have.been.calledWith(
          `/lists/list_id/members/${this.emailHash}`
        )
      })

      it('ignores a Mailchimp error about fake emails', async function () {
        this.mailchimp.delete.rejects(
          new Error(
            'overleaf.duck@example.com looks fake or invalid, please enter a real email address'
          )
        )
        await expect(
          this.NewsletterManager.unsubscribe(this.user, { delete: true })
        ).to.be.fulfilled
      })

      it('rejects on other errors', async function () {
        this.mailchimp.delete.rejects(
          new Error('something really wrong is happening')
        )
        await expect(
          this.NewsletterManager.unsubscribe(this.user, { delete: true })
        ).to.be.rejected
      })
    })
  })

  describe('changeEmail', function () {
    it('calls Mailchimp to change the subscriber email', async function () {
      await this.NewsletterManager.changeEmail(
        this.user,
        'overleaf.squirrel@example.com'
      )
      expect(this.mailchimp.patch).to.have.been.calledWith(
        `/lists/list_id/members/${this.emailHash}`,
        {
          email_address: 'overleaf.squirrel@example.com',
          merge_fields: this.mergeFields,
        }
      )
    })

    it('deletes the old email if changing the address fails', async function () {
      this.mailchimp.patch
        .withArgs(`/lists/list_id/members/${this.emailHash}`, {
          email_address: 'overleaf.squirrel@example.com',
          merge_fields: this.mergeFields,
        })
        .rejects(new Error('that did not work'))

      await expect(
        this.NewsletterManager.changeEmail(
          this.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.rejected

      expect(this.mailchimp.delete).to.have.been.calledWith(
        `/lists/list_id/members/${this.emailHash}`
      )
    })

    it('does not reject on non-fatal error ', async function () {
      const nonFatalError = new Error('merge fields were invalid')
      this.mailchimp.patch.rejects(nonFatalError)
      await expect(
        this.NewsletterManager.changeEmail(
          this.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.fulfilled
    })

    it('rejects on any other error', async function () {
      const fatalError = new Error('fatal error')
      this.mailchimp.patch.rejects(fatalError)
      await expect(
        this.NewsletterManager.changeEmail(
          this.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.rejected
    })
  })
})
