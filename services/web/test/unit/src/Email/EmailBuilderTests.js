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
      brandPrefix: ''
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
})
