/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Email/EmailSender.js'
)
const { expect } = require('chai')

describe('EmailSender', function() {
  beforeEach(function() {
    this.RateLimiter = { addCount: sinon.stub() }

    this.settings = {
      email: {
        transport: 'ses',
        parameters: {
          AWSAccessKeyID: 'key',
          AWSSecretKey: 'secret'
        },
        fromAddress: 'bob@bob.com',
        replyToAddress: 'sally@gmail.com'
      }
    }

    this.sesClient = { sendMail: sinon.stub() }

    this.ses = { createTransport: () => this.sesClient }

    this.sender = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        nodemailer: this.ses,
        'nodemailer-mandrill-transport': {},
        'nodemailer-sendgrid-transport': {},
        'settings-sharelatex': this.settings,
        '../../infrastructure/RateLimiter': this.RateLimiter,
        'logger-sharelatex': {
          log() {},
          warn() {},
          err() {}
        },
        'metrics-sharelatex': {
          inc() {}
        }
      }
    })

    return (this.opts = {
      to: 'bob@bob.com',
      subject: 'new email',
      html: '<hello></hello>'
    })
  })

  describe('sendEmail', function() {
    it('should set the properties on the email to send', function(done) {
      this.sesClient.sendMail.callsArgWith(1)

      return this.sender.sendEmail(this.opts, err => {
        expect(err).to.not.exist
        const args = this.sesClient.sendMail.args[0][0]
        args.html.should.equal(this.opts.html)
        args.to.should.equal(this.opts.to)
        args.subject.should.equal(this.opts.subject)
        return done()
      })
    })

    it('should return a non-specific error', function(done) {
      this.sesClient.sendMail.callsArgWith(1, 'error')
      return this.sender.sendEmail({}, err => {
        err.should.exist
        err.toString().should.equal('Error: Cannot send email')
        return done()
      })
    })

    it('should use the from address from settings', function(done) {
      this.sesClient.sendMail.callsArgWith(1)

      return this.sender.sendEmail(this.opts, () => {
        const args = this.sesClient.sendMail.args[0][0]
        args.from.should.equal(this.settings.email.fromAddress)
        return done()
      })
    })

    it('should use the reply to address from settings', function(done) {
      this.sesClient.sendMail.callsArgWith(1)

      return this.sender.sendEmail(this.opts, () => {
        const args = this.sesClient.sendMail.args[0][0]
        args.replyTo.should.equal(this.settings.email.replyToAddress)
        return done()
      })
    })

    it('should use the reply to address in options as an override', function(done) {
      this.sesClient.sendMail.callsArgWith(1)

      this.opts.replyTo = 'someone@else.com'
      return this.sender.sendEmail(this.opts, () => {
        const args = this.sesClient.sendMail.args[0][0]
        args.replyTo.should.equal(this.opts.replyTo)
        return done()
      })
    })

    it('should not send an email when the rate limiter says no', function(done) {
      this.opts.sendingUser_id = '12321312321'
      this.RateLimiter.addCount.callsArgWith(1, null, false)
      return this.sender.sendEmail(this.opts, () => {
        this.sesClient.sendMail.called.should.equal(false)
        return done()
      })
    })

    it('should send the email when the rate limtier says continue', function(done) {
      this.sesClient.sendMail.callsArgWith(1)
      this.opts.sendingUser_id = '12321312321'
      this.RateLimiter.addCount.callsArgWith(1, null, true)
      return this.sender.sendEmail(this.opts, () => {
        this.sesClient.sendMail.called.should.equal(true)
        return done()
      })
    })

    it('should not check the rate limiter when there is no sendingUser_id', function(done) {
      this.sesClient.sendMail.callsArgWith(1)
      return this.sender.sendEmail(this.opts, () => {
        this.sesClient.sendMail.called.should.equal(true)
        this.RateLimiter.addCount.called.should.equal(false)
        return done()
      })
    })

    describe('with plain-text email content', function() {
      beforeEach(function() {
        return (this.opts.text = 'hello there')
      })

      it('should set the text property on the email to send', function(done) {
        this.sesClient.sendMail.callsArgWith(1)

        return this.sender.sendEmail(this.opts, () => {
          const args = this.sesClient.sendMail.args[0][0]
          args.html.should.equal(this.opts.html)
          args.text.should.equal(this.opts.text)
          args.to.should.equal(this.opts.to)
          args.subject.should.equal(this.opts.subject)
          return done()
        })
      })
    })
  })
})
