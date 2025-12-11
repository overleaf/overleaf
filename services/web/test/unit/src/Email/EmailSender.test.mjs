import { vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/EmailSender.mjs'
)

describe('EmailSender', function () {
  beforeEach(async function (ctx) {
    ctx.rateLimiter = {
      consume: sinon.stub().resolves(),
    }
    ctx.RateLimiter = {
      RateLimiter: sinon.stub().returns(ctx.rateLimiter),
    }

    ctx.Settings = {
      email: {
        transport: 'ses',
        parameters: {
          AWSAccessKeyID: 'key',
          AWSSecretKey: 'secret',
        },
        fromAddress: 'bob@bob.com',
        replyToAddress: 'sally@gmail.com',
      },
    }

    ctx.sesClient = { sendMail: sinon.stub().resolves() }

    ctx.ses = { createTransport: () => ctx.sesClient }

    ctx.SESClient = sinon.stub()

    vi.doMock('nodemailer', () => ({
      default: ctx.ses,
    }))

    vi.doMock('@aws-sdk/client-ses', () => ({
      SESClient: ctx.SESClient,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.Settings,
    }))

    vi.doMock(
      '../../../../app/src/infrastructure/RateLimiter',
      () => ctx.RateLimiter
    )

    vi.doMock('@overleaf/metrics', () => ({
      default: {
        inc() {},
      },
    }))

    ctx.EmailSender = (await import(MODULE_PATH)).default

    ctx.opts = {
      to: 'bob@bob.com',
      subject: 'new email',
      html: '<hello></hello>',
    }
  })

  describe('sendEmail', function () {
    it('should set the properties on the email to send', async function (ctx) {
      await ctx.EmailSender.promises.sendEmail(ctx.opts)
      expect(ctx.sesClient.sendMail).to.have.been.calledWithMatch({
        html: ctx.opts.html,
        to: ctx.opts.to,
        subject: ctx.opts.subject,
      })
    })

    it('should return a non-specific error', async function (ctx) {
      ctx.sesClient.sendMail.rejects(new Error('boom'))
      await expect(ctx.EmailSender.promises.sendEmail({})).to.be.rejectedWith(
        'error sending message'
      )
    })

    it('should use the from address from settings', async function (ctx) {
      await ctx.EmailSender.promises.sendEmail(ctx.opts)
      expect(ctx.sesClient.sendMail).to.have.been.calledWithMatch({
        from: ctx.Settings.email.fromAddress,
      })
    })

    it('should use the reply to address from settings', async function (ctx) {
      await ctx.EmailSender.promises.sendEmail(ctx.opts)
      expect(ctx.sesClient.sendMail).to.have.been.calledWithMatch({
        replyTo: ctx.Settings.email.replyToAddress,
      })
    })

    it('should use the reply to address in options as an override', async function (ctx) {
      ctx.opts.replyTo = 'someone@else.com'
      await ctx.EmailSender.promises.sendEmail(ctx.opts)
      expect(ctx.sesClient.sendMail).to.have.been.calledWithMatch({
        replyTo: ctx.opts.replyTo,
      })
    })

    it('should not send an email when the rate limiter says no', async function (ctx) {
      ctx.opts.sendingUser_id = '12321312321'
      ctx.rateLimiter.consume.rejects({ remainingPoints: 0 })
      await expect(ctx.EmailSender.promises.sendEmail(ctx.opts)).to.be.rejected
      expect(ctx.sesClient.sendMail).not.to.have.been.called
    })

    it('should send the email when the rate limtier says continue', async function (ctx) {
      ctx.opts.sendingUser_id = '12321312321'
      await ctx.EmailSender.promises.sendEmail(ctx.opts)
      expect(ctx.sesClient.sendMail).to.have.been.called
    })

    it('should not check the rate limiter when there is no sendingUser_id', async function (ctx) {
      ctx.EmailSender.sendEmail(ctx.opts, () => {
        expect(ctx.sesClient.sendMail).to.have.been.called
        expect(ctx.rateLimiter.consume).not.to.have.been.called
      })
    })

    describe('with plain-text email content', function () {
      beforeEach(function (ctx) {
        ctx.opts.text = 'hello there'
      })

      it('should set the text property on the email to send', async function (ctx) {
        await ctx.EmailSender.promises.sendEmail(ctx.opts)
        expect(ctx.sesClient.sendMail).to.have.been.calledWithMatch({
          html: ctx.opts.html,
          text: ctx.opts.text,
          to: ctx.opts.to,
          subject: ctx.opts.subject,
        })
      })
    })
  })
})
