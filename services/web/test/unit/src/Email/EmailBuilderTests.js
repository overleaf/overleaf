const SandboxedModule = require('sandboxed-module')
const path = require('path')
const { expect } = require('chai')
const _ = require('underscore')
_.templateSettings = { interpolate: /\{\{(.+?)\}\}/g }

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Email/EmailBuilder'
)

describe('EmailBuilder', function() {
  beforeEach(function() {
    this.settings = {
      appName: 'testApp',
      brandPrefix: '',
      siteUrl: 'https://www.overleaf.com'
    }
    this.EmailBuilder = SandboxedModule.require(MODULE_PATH, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {}
        }
      }
    })
  })

  describe('projectInvite', function() {
    beforeEach(function() {
      this.opts = {
        to: 'bob@bob.com',
        first_name: 'bob',
        owner: {
          email: 'sally@hally.com'
        },
        inviteUrl: 'http://example.com/invite',
        project: {
          url: 'http://www.project.com',
          name: 'standard project'
        }
      }
    })

    describe('when sending a normal email', function() {
      beforeEach(function() {
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
      })

      it('should have html and text properties', function() {
        expect(this.email.html != null).to.equal(true)
        expect(this.email.text != null).to.equal(true)
      })

      it('should not have undefined in it', function() {
        this.email.html.indexOf('undefined').should.equal(-1)
        this.email.subject.indexOf('undefined').should.equal(-1)
      })
    })

    describe('when someone is up to no good', function() {
      beforeEach(function() {
        this.opts.project.name = "<img src='http://evilsite.com/evil.php'>"
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
      })

      it('should not contain unescaped html in the html part', function() {
        expect(this.email.html).to.contain('New Project')
      })

      it('should not have undefined in it', function() {
        this.email.html.indexOf('undefined').should.equal(-1)
        this.email.subject.indexOf('undefined').should.equal(-1)
      })
    })
  })

  describe('SpamSafe', function() {
    beforeEach(function() {
      this.opts = {
        to: 'bob@joe.com',
        first_name: 'bob',
        owner: {
          email: 'sally@hally.com'
        },
        inviteUrl: 'http://example.com/invite',
        project: {
          url: 'http://www.project.com',
          name: 'come buy my product at http://notascam.com'
        }
      }
      this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
    })

    it('should replace spammy project name', function() {
      this.email.html.indexOf('a new project').should.not.equal(-1)
      this.email.subject.indexOf('New Project').should.not.equal(-1)
    })
  })

  describe('templates', function() {
    describe('securityAlert', function() {
      before(function() {
        this.message = 'more details about the action'
        this.messageHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${
          this.message
        }</i></b></span>`
        this.messageNotAllowedHTML = `<div></div>${this.messageHTML}`

        this.actionDescribed = 'an action described'
        this.actionDescribedHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${
          this.actionDescribed
        }</i></b>`
        this.actionDescribedNotAllowedHTML = `<div></div>${
          this.actionDescribedHTML
        }`

        this.opts = {
          to: this.email,
          actionDescribed: this.actionDescribedNotAllowedHTML,
          action: 'an action',
          message: [this.messageNotAllowedHTML]
        }
        this.email = this.EmailBuilder.buildEmail('securityAlert', this.opts)
      })

      it('should build the email', function() {
        expect(this.email.html != null).to.equal(true)
        expect(this.email.text != null).to.equal(true)
      })

      describe('HTML email', function() {
        it('should clean HTML in opts.actionDescribed', function() {
          expect(this.email.html).to.not.contain(
            this.actionDescribedNotAllowedHTML
          )
          expect(this.email.html).to.contain(this.actionDescribedHTML)
        })
        it('should clean HTML in opts.message', function() {
          expect(this.email.html).to.not.contain(this.messageNotAllowedHTML)
          expect(this.email.html).to.contain(this.messageHTML)
        })
      })

      describe('plain text email', function() {
        it('should remove all HTML in opts.actionDescribed', function() {
          expect(this.email.text).to.not.contain(this.actionDescribedHTML)
          expect(this.email.text).to.contain(this.actionDescribed)
        })
        it('should remove all HTML in opts.message', function() {
          expect(this.email.text).to.not.contain(this.messageHTML)
          expect(this.email.text).to.contain(this.message)
        })
      })
    })
  })
})
