import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/EmailHandler'
)

describe('EmailHandler', function () {
  beforeEach(async function (ctx) {
    ctx.html = '<html>hello</html>'
    ctx.Settings = { email: {} }
    ctx.EmailBuilder = {
      buildEmail: sinon.stub().returns({ html: ctx.html }),
    }
    ctx.EmailSender = {
      promises: {
        sendEmail: sinon.stub().resolves(),
      },
    }
    ctx.Queues = {
      createScheduledJob: sinon.stub().resolves(),
    }

    vi.doMock('../../../../app/src/Features/Email/EmailBuilder', () => ({
      default: ctx.EmailBuilder,
    }))

    vi.doMock('../../../../app/src/Features/Email/EmailSender', () => ({
      default: ctx.EmailSender,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock('../../../../app/src/infrastructure/Queues', () => ({
      default: ctx.Queues,
    }))

    ctx.EmailHandler = (await import(MODULE_PATH)).default
  })

  describe('send email', function () {
    it('should use the correct options', async function (ctx) {
      const opts = { to: 'bob@bob.com' }
      await ctx.EmailHandler.promises.sendEmail('welcome', opts)
      expect(ctx.EmailSender.promises.sendEmail).to.have.been.calledWithMatch({
        html: ctx.html,
      })
    })

    it('should return the error', async function (ctx) {
      ctx.EmailSender.promises.sendEmail.rejects(new Error('boom'))
      const opts = {
        to: 'bob@bob.com',
        subject: 'hello bob',
      }
      await expect(ctx.EmailHandler.promises.sendEmail('welcome', opts)).to.be
        .rejected
    })

    it('should not send an email if lifecycle is not enabled', async function (ctx) {
      ctx.Settings.email.lifecycle = false
      ctx.EmailBuilder.buildEmail.returns({ type: 'lifecycle' })
      await ctx.EmailHandler.promises.sendEmail('welcome', {})
      expect(ctx.EmailSender.promises.sendEmail).not.to.have.been.called
    })

    it('should send an email if lifecycle is not enabled but the type is notification', async function (ctx) {
      ctx.Settings.email.lifecycle = false
      ctx.EmailBuilder.buildEmail.returns({ type: 'notification' })
      const opts = { to: 'bob@bob.com' }
      await ctx.EmailHandler.promises.sendEmail('welcome', opts)
      expect(ctx.EmailSender.promises.sendEmail).to.have.been.called
    })

    it('should send lifecycle email if it is enabled', async function (ctx) {
      ctx.Settings.email.lifecycle = true
      ctx.EmailBuilder.buildEmail.returns({ type: 'lifecycle' })
      const opts = { to: 'bob@bob.com' }
      await ctx.EmailHandler.promises.sendEmail('welcome', opts)
      expect(ctx.EmailSender.promises.sendEmail).to.have.been.called
    })

    describe('with plain-text email content', function () {
      beforeEach(function (ctx) {
        ctx.text = 'hello there'
      })

      it('should pass along the text field', async function (ctx) {
        ctx.EmailBuilder.buildEmail.returns({
          html: ctx.html,
          text: ctx.text,
        })
        const opts = { to: 'bob@bob.com' }
        await ctx.EmailHandler.promises.sendEmail('welcome', opts)
        expect(ctx.EmailSender.promises.sendEmail).to.have.been.calledWithMatch(
          {
            html: ctx.html,
            text: ctx.text,
          }
        )
      })
    })
  })

  describe('send deferred email', function () {
    beforeEach(function (ctx) {
      ctx.opts = {
        to: 'bob@bob.com',
        first_name: 'hello bob',
      }
      ctx.emailType = 'canceledSubscription'
      ctx.ONE_HOUR_IN_MS = 1000 * 60 * 60
      ctx.EmailHandler.sendDeferredEmail(
        ctx.emailType,
        ctx.opts,
        ctx.ONE_HOUR_IN_MS
      )
    })
    it('should add a email job to the queue', function (ctx) {
      expect(ctx.Queues.createScheduledJob).to.have.been.calledWith(
        'deferred-emails',
        { data: { emailType: ctx.emailType, opts: ctx.opts } },
        ctx.ONE_HOUR_IN_MS
      )
    })
  })
})
