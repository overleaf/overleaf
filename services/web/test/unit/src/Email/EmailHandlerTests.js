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
  '../../../../app/src/Features/Email/EmailHandler'
)
const { expect } = require('chai')

describe('EmailHandler', function() {
  beforeEach(function() {
    this.settings = { email: {} }
    this.EmailBuilder = { buildEmail: sinon.stub() }
    this.EmailSender = { sendEmail: sinon.stub() }
    this.EmailHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        './EmailBuilder': this.EmailBuilder,
        './EmailSender': this.EmailSender,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        }
      }
    })

    return (this.html = '<html>hello</html>')
  })

  describe('send email', function() {
    it('should use the correct options', function(done) {
      this.EmailBuilder.buildEmail.returns({ html: this.html })
      this.EmailSender.sendEmail.callsArgWith(1)

      const opts = { to: 'bob@bob.com' }
      return this.EmailHandler.sendEmail('welcome', opts, () => {
        const args = this.EmailSender.sendEmail.args[0][0]
        args.html.should.equal(this.html)
        return done()
      })
    })

    it('should return the erroor', function(done) {
      this.EmailBuilder.buildEmail.returns({ html: this.html })
      this.EmailSender.sendEmail.callsArgWith(1, 'error')

      const opts = {
        to: 'bob@bob.com',
        subject: 'hello bob'
      }
      return this.EmailHandler.sendEmail('welcome', opts, err => {
        err.should.equal('error')
        return done()
      })
    })

    it('should not send an email if lifecycle is not enabled', function(done) {
      this.settings.email.lifecycle = false
      this.EmailBuilder.buildEmail.returns({ type: 'lifecycle' })
      return this.EmailHandler.sendEmail('welcome', {}, () => {
        this.EmailSender.sendEmail.called.should.equal(false)
        return done()
      })
    })

    it('should send an email if lifecycle is not enabled but the type is notification', function(done) {
      this.settings.email.lifecycle = false
      this.EmailBuilder.buildEmail.returns({ type: 'notification' })
      this.EmailSender.sendEmail.callsArgWith(1)
      const opts = { to: 'bob@bob.com' }
      return this.EmailHandler.sendEmail('welcome', opts, () => {
        this.EmailSender.sendEmail.called.should.equal(true)
        return done()
      })
    })

    it('should send lifecycle email if it is enabled', function(done) {
      this.settings.email.lifecycle = true
      this.EmailBuilder.buildEmail.returns({ type: 'lifecycle' })
      this.EmailSender.sendEmail.callsArgWith(1)
      const opts = { to: 'bob@bob.com' }
      return this.EmailHandler.sendEmail('welcome', opts, () => {
        this.EmailSender.sendEmail.called.should.equal(true)
        return done()
      })
    })

    describe('with plain-text email content', function() {
      beforeEach(function() {
        return (this.text = 'hello there')
      })

      it('should pass along the text field', function(done) {
        this.EmailBuilder.buildEmail.returns({
          html: this.html,
          text: this.text
        })
        this.EmailSender.sendEmail.callsArgWith(1)
        const opts = { to: 'bob@bob.com' }
        return this.EmailHandler.sendEmail('welcome', opts, () => {
          const args = this.EmailSender.sendEmail.args[0][0]
          args.html.should.equal(this.html)
          args.text.should.equal(this.text)
          return done()
        })
      })
    })
  })
})
