const SandboxedModule = require('sandboxed-module')
const cheerio = require('cheerio')
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

  describe('ctaTemplate', function() {
    describe('missing required content', function() {
      const content = {
        title: () => {},
        greeting: () => {},
        message: () => {},
        secondaryMessage: () => {},
        ctaText: () => {},
        ctaURL: () => {},
        gmailGoToAction: () => {}
      }
      it('should throw an error when missing title', function() {
        let { title, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing message', function() {
        let { message, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaText', function() {
        let { ctaText, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaURL', function() {
        let { ctaURL, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
    })
  })

  describe('templates', function() {
    describe('CTA', function() {
      describe('canceledSubscription', function() {
        beforeEach(function() {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress
          }
          this.email = this.EmailBuilder.buildEmail(
            'canceledSubscription',
            this.opts
          )
          this.expectedUrl =
            'https://docs.google.com/forms/d/e/1FAIpQLSfa7z_s-cucRRXm70N4jEcSbFsZeb0yuKThHGQL8ySEaQzF0Q/viewform?usp=sf_link'
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Leave Feedback")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })

      describe('confirmEmail', function() {
        before(function() {
          this.emailAddress = 'example@overleaf.com'
          this.userId = 'abc123'
          this.opts = {
            to: this.emailAddress,
            confirmEmailUrl: `${
              this.settings.siteUrl
            }/user/emails/confirm?token=aToken123`,
            sendingUser_id: this.userId
          }
          this.email = this.EmailBuilder.buildEmail('confirmEmail', this.opts)
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Confirm Email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.confirmEmailUrl)
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.opts.confirmEmailUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.opts.confirmEmailUrl)
          })
        })
      })

      describe('ownershipTransferConfirmationNewOwner', function() {
        before(function() {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            previousOwner: {},
            project: {
              _id: 'abc123',
              name: 'example project'
            }
          }
          this.email = this.EmailBuilder.buildEmail(
            'ownershipTransferConfirmationNewOwner',
            this.opts
          )
          this.expectedUrl = `${
            this.settings.siteUrl
          }/project/${this.opts.project._id.toString()}`
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })

      describe('passwordResetRequested', function() {
        before(function() {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            setNewPasswordUrl: `${
              this.settings.siteUrl
            }/user/password/set?passwordResetToken=aToken&email=${encodeURIComponent(
              this.emailAddress
            )}`
          }
          this.email = this.EmailBuilder.buildEmail(
            'passwordResetRequested',
            this.opts
          )
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(
              this.opts.setNewPasswordUrl
            )
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(this.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.opts.setNewPasswordUrl)
          })
        })
      })

      describe('verifyEmailToJoinTeam', function() {
        before(function() {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            acceptInviteUrl: `${
              this.settings.siteUrl
            }/subscription/invites/aToken123/`,
            inviter: {
              email: 'deanna@overleaf.com',
              first_name: 'Deanna',
              last_name: 'Troi'
            }
          }
          this.email = this.EmailBuilder.buildEmail(
            'verifyEmailToJoinTeam',
            this.opts
          )
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Join now")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.acceptInviteUrl)
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.opts.acceptInviteUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.opts.acceptInviteUrl)
          })
        })
      })

      describe('reactivatedSubscription', function() {
        before(function() {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress
          }
          this.email = this.EmailBuilder.buildEmail(
            'reactivatedSubscription',
            this.opts
          )
          this.expectedUrl = `${this.settings.siteUrl}/user/subscription`
        })

        it('should build the email', function() {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function() {
          it('should include a CTA button and a fallback CTA link', function() {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("View Subscription Dashboard")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.avoid-auto-linking').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function() {
          it('should contain the CTA link', function() {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })
    })
    describe('no CTA', function() {
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
})
