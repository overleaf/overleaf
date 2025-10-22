import { beforeEach, describe, expect, it, vi } from 'vitest'
import sinon from 'sinon'
import { RequestFailedError } from '@overleaf/fetch-utils'

const MODULE_PATH = '../../../../app/src/Features/Newsletter/NewsletterManager'

describe('NewsletterManager', function () {
  beforeEach(async function (ctx) {
    ctx.Settings = {
      mailchimp: {
        api_key: 'api_key',
        list_id: 'list_id',
      },
    }
    ctx.mailchimp = {
      get: sinon.stub(),
      put: sinon.stub(),
      patch: sinon.stub(),
      delete: sinon.stub(),
    }
    ctx.Mailchimp = sinon.stub().returns(ctx.mailchimp)

    ctx.mergeFields = {
      FNAME: 'Overleaf',
      LNAME: 'Duck',
      MONGO_ID: 'user_id',
    }

    vi.doMock(
      '../../../../app/src/Features/Newsletter/MailChimpClient',
      () => ({
        default: ctx.Mailchimp,
      })
    )

    vi.doMock('@overleaf/settings', () => ({ default: ctx.Settings }))

    ctx.NewsletterManager = (await import(MODULE_PATH)).default.promises

    ctx.NewsletterManager.get = sinon.stub()
    ctx.NewsletterManager.delete = sinon.stub()

    ctx.user = {
      _id: 'user_id',
      email: 'overleaf.duck@example.com',
      first_name: 'Overleaf',
      last_name: 'Duck',
    }
    // MD5 sum of the user email
    ctx.emailHash = 'c02f60ed0ef51818186274e406c9a48f'
  })

  describe('subscribed', function () {
    it('calls Mailchimp to get the user status', async function (ctx) {
      await ctx.NewsletterManager.subscribed(ctx.user)
      expect(ctx.mailchimp.get).to.have.been.calledWith(
        `/lists/list_id/members/${ctx.emailHash}`
      )
    })

    it('returns true when subscribed', async function (ctx) {
      ctx.mailchimp.get.resolves({ status: 'subscribed' })

      const subscribed = await ctx.NewsletterManager.subscribed(ctx.user)
      expect(subscribed).to.be.true
    })

    it('returns false on 404', async function (ctx) {
      ctx.mailchimp.get.rejects(
        new RequestFailedError(
          'http://some-url',
          {},
          { status: 404 },
          'Not found'
        )
      )
      const subscribed = await ctx.NewsletterManager.subscribed(ctx.user)
      expect(subscribed).to.be.false
    })
  })

  describe('subscribe', function () {
    it('calls Mailchimp to subscribe the user', async function (ctx) {
      await ctx.NewsletterManager.subscribe(ctx.user)
      expect(ctx.mailchimp.put).to.have.been.calledWith(
        `/lists/list_id/members/${ctx.emailHash}`,
        {
          email_address: ctx.user.email,
          status: 'subscribed',
          status_if_new: 'subscribed',
          merge_fields: ctx.mergeFields,
        }
      )
    })
  })

  describe('unsubscribe', function () {
    describe('when unsubscribing normally', function () {
      it('calls Mailchimp to unsubscribe the user', async function (ctx) {
        await ctx.NewsletterManager.unsubscribe(ctx.user)
        expect(ctx.mailchimp.patch).to.have.been.calledWith(
          `/lists/list_id/members/${ctx.emailHash}`,
          {
            status: 'unsubscribed',
            merge_fields: ctx.mergeFields,
          }
        )
      })

      it('ignores a Mailchimp error about fake emails', async function (ctx) {
        ctx.mailchimp.patch.rejects(
          new Error(
            'overleaf.duck@example.com looks fake or invalid, please enter a real email address'
          )
        )
        await expect(ctx.NewsletterManager.unsubscribe(ctx.user)).to.be
          .fulfilled
      })

      it('rejects on other errors', async function (ctx) {
        ctx.mailchimp.patch.rejects(
          new Error('something really wrong is happening')
        )
        await expect(ctx.NewsletterManager.unsubscribe(ctx.user)).to.be.rejected
      })
    })

    describe('when deleting', function () {
      it('calls Mailchimp to delete the user', async function (ctx) {
        await ctx.NewsletterManager.unsubscribe(ctx.user, { delete: true })
        expect(ctx.mailchimp.delete).to.have.been.calledWith(
          `/lists/list_id/members/${ctx.emailHash}`
        )
      })

      it('ignores a Mailchimp error about fake emails', async function (ctx) {
        ctx.mailchimp.delete.rejects(
          new Error(
            'overleaf.duck@example.com looks fake or invalid, please enter a real email address'
          )
        )
        await expect(
          ctx.NewsletterManager.unsubscribe(ctx.user, { delete: true })
        ).to.be.fulfilled
      })

      it('rejects on other errors', async function (ctx) {
        ctx.mailchimp.delete.rejects(
          new Error('something really wrong is happening')
        )
        await expect(
          ctx.NewsletterManager.unsubscribe(ctx.user, { delete: true })
        ).to.be.rejected
      })
    })
  })

  describe('changeEmail', function () {
    it('calls Mailchimp to change the subscriber email', async function (ctx) {
      await ctx.NewsletterManager.changeEmail(
        ctx.user,
        'overleaf.squirrel@example.com'
      )
      expect(ctx.mailchimp.patch).to.have.been.calledWith(
        `/lists/list_id/members/${ctx.emailHash}`,
        {
          email_address: 'overleaf.squirrel@example.com',
          merge_fields: ctx.mergeFields,
        }
      )
    })

    it('deletes the old email if changing the address fails', async function (ctx) {
      ctx.mailchimp.patch
        .withArgs(`/lists/list_id/members/${ctx.emailHash}`, {
          email_address: 'overleaf.squirrel@example.com',
          merge_fields: ctx.mergeFields,
        })
        .rejects(new Error('that did not work'))

      await expect(
        ctx.NewsletterManager.changeEmail(
          ctx.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.rejected

      expect(ctx.mailchimp.delete).to.have.been.calledWith(
        `/lists/list_id/members/${ctx.emailHash}`
      )
    })

    it('does not reject on non-fatal error ', async function (ctx) {
      const nonFatalError = new Error('merge fields were invalid')
      ctx.mailchimp.patch.rejects(nonFatalError)
      await expect(
        ctx.NewsletterManager.changeEmail(
          ctx.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.fulfilled
    })

    it('rejects on any other error', async function (ctx) {
      const fatalError = new Error('fatal error')
      ctx.mailchimp.patch.rejects(fatalError)
      await expect(
        ctx.NewsletterManager.changeEmail(
          ctx.user,
          'overleaf.squirrel@example.com'
        )
      ).to.be.rejected
    })
  })
})
