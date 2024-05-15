const SandboxedModule = require('sandboxed-module')
const cheerio = require('cheerio')
const path = require('path')
const { expect } = require('chai')

const MODULE_PATH = path.join(
  __dirname,
  '../../../../app/src/Features/Email/EmailBuilder'
)

const EmailMessageHelper = require('../../../../app/src/Features/Email/EmailMessageHelper')
const ctaEmailBody = require('../../../../app/src/Features/Email/Bodies/cta-email')
const NoCTAEmailBody = require('../../../../app/src/Features/Email/Bodies/NoCTAEmailBody')
const BaseWithHeaderEmailLayout = require('../../../../app/src/Features/Email/Layouts/BaseWithHeaderEmailLayout')

describe('EmailBuilder', function () {
  before(function () {
    this.settings = {
      appName: 'testApp',
      siteUrl: 'https://www.overleaf.com',
    }
    this.EmailBuilder = SandboxedModule.require(MODULE_PATH, {
      requires: {
        './EmailMessageHelper': EmailMessageHelper,
        './Bodies/cta-email': ctaEmailBody,
        './Bodies/NoCTAEmailBody': NoCTAEmailBody,
        './Layouts/BaseWithHeaderEmailLayout': BaseWithHeaderEmailLayout,
        '@overleaf/settings': this.settings,
      },
    })
  })

  describe('projectInvite', function () {
    beforeEach(function () {
      this.opts = {
        to: 'bob@bob.com',
        first_name: 'bob',
        owner: {
          email: 'sally@hally.com',
        },
        inviteUrl: 'http://example.com/invite',
        project: {
          url: 'http://www.project.com',
          name: 'standard project',
        },
      }
    })

    describe('when sending a normal email', function () {
      beforeEach(function () {
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
      })

      it('should have html and text properties', function () {
        expect(this.email.html != null).to.equal(true)
        expect(this.email.text != null).to.equal(true)
      })

      it('should not have undefined in it', function () {
        this.email.html.indexOf('undefined').should.equal(-1)
        this.email.subject.indexOf('undefined').should.equal(-1)
      })
    })

    describe('when someone is up to no good', function () {
      it('should not contain the project name at all if unsafe', function () {
        this.opts.project.name = "<img src='http://evilsite.com/evil.php'>"
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
        expect(this.email.html).to.not.contain('evilsite.com')
        expect(this.email.subject).to.not.contain('evilsite.com')

        // but email should appear
        expect(this.email.html).to.contain(this.opts.owner.email)
        expect(this.email.subject).to.contain(this.opts.owner.email)
      })

      it('should not contain the inviter email at all if unsafe', function () {
        this.opts.owner.email =
          'verylongemailaddressthatwillfailthecheck@longdomain.domain'
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)

        expect(this.email.html).to.not.contain(this.opts.owner.email)
        expect(this.email.subject).to.not.contain(this.opts.owner.email)

        // but title should appear
        expect(this.email.html).to.contain(this.opts.project.name)
        expect(this.email.subject).to.contain(this.opts.project.name)
      })

      it('should handle both email and title being unsafe', function () {
        this.opts.project.name = "<img src='http://evilsite.com/evil.php'>"
        this.opts.owner.email =
          'verylongemailaddressthatwillfailthecheck@longdomain.domain'
        this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)

        expect(this.email.html).to.not.contain('evilsite.com')
        expect(this.email.subject).to.not.contain('evilsite.com')
        expect(this.email.html).to.not.contain(this.opts.owner.email)
        expect(this.email.subject).to.not.contain(this.opts.owner.email)

        expect(this.email.html).to.contain(
          'Please view the project to find out more'
        )
      })
    })
  })

  describe('SpamSafe', function () {
    beforeEach(function () {
      this.opts = {
        to: 'bob@joe.com',
        first_name: 'bob',
        newOwner: {
          email: 'sally@hally.com',
        },
        inviteUrl: 'http://example.com/invite',
        project: {
          url: 'http://www.project.com',
          name: 'come buy my product at http://notascam.com',
        },
      }
      this.email = this.EmailBuilder.buildEmail(
        'ownershipTransferConfirmationPreviousOwner',
        this.opts
      )
    })

    it('should replace spammy project name', function () {
      this.email.html.indexOf('your project').should.not.equal(-1)
    })
  })

  describe('ctaTemplate', function () {
    describe('missing required content', function () {
      const content = {
        title: () => {},
        greeting: () => {},
        message: () => {},
        secondaryMessage: () => {},
        ctaText: () => {},
        ctaURL: () => {},
        gmailGoToAction: () => {},
      }
      it('should throw an error when missing title', function () {
        const { title, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing message', function () {
        const { message, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaText', function () {
        const { ctaText, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaURL', function () {
        const { ctaURL, ...missing } = content
        expect(() => {
          this.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
    })
  })

  describe('templates', function () {
    describe('CTA', function () {
      describe('canceledSubscription', function () {
        beforeEach(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
          }
          this.email = this.EmailBuilder.buildEmail(
            'canceledSubscription',
            this.opts
          )
          this.expectedUrl =
            'https://docs.google.com/forms/d/e/1FAIpQLSfa7z_s-cucRRXm70N4jEcSbFsZeb0yuKThHGQL8ySEaQzF0Q/viewform?usp=sf_link'
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Leave Feedback")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })

      describe('confirmEmail', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.userId = 'abc123'
          this.opts = {
            to: this.emailAddress,
            confirmEmailUrl: `${this.settings.siteUrl}/user/emails/confirm?token=aToken123`,
            sendingUser_id: this.userId,
          }
          this.email = this.EmailBuilder.buildEmail('confirmEmail', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Confirm Email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.confirmEmailUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.opts.confirmEmailUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.confirmEmailUrl)
          })
        })
      })

      describe('ownershipTransferConfirmationNewOwner', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            previousOwner: {},
            project: {
              _id: 'abc123',
              name: 'example project',
            },
          }
          this.email = this.EmailBuilder.buildEmail(
            'ownershipTransferConfirmationNewOwner',
            this.opts
          )
          this.expectedUrl = `${
            this.settings.siteUrl
          }/project/${this.opts.project._id.toString()}`
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })

      describe('passwordResetRequested', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            setNewPasswordUrl: `${
              this.settings.siteUrl
            }/user/password/set?passwordResetToken=aToken&email=${encodeURIComponent(
              this.emailAddress
            )}`,
          }
          this.email = this.EmailBuilder.buildEmail(
            'passwordResetRequested',
            this.opts
          )
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(
              this.opts.setNewPasswordUrl
            )
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(this.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.setNewPasswordUrl)
          })
        })
      })

      describe('reconfirmEmail', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.userId = 'abc123'
          this.opts = {
            to: this.emailAddress,
            confirmEmailUrl: `${this.settings.siteUrl}/user/emails/confirm?token=aToken123`,
            sendingUser_id: this.userId,
          }
          this.email = this.EmailBuilder.buildEmail('reconfirmEmail', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Reconfirm Email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.confirmEmailUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.opts.confirmEmailUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.confirmEmailUrl)
          })
        })
      })

      describe('verifyEmailToJoinTeam', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            acceptInviteUrl: `${this.settings.siteUrl}/subscription/invites/aToken123/`,
            inviter: {
              email: 'deanna@overleaf.com',
              first_name: 'Deanna',
              last_name: 'Troi',
            },
          }
          this.email = this.EmailBuilder.buildEmail(
            'verifyEmailToJoinTeam',
            this.opts
          )
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Join now")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.acceptInviteUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.opts.acceptInviteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.acceptInviteUrl)
          })
        })
      })

      describe('reactivatedSubscription', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
          }
          this.email = this.EmailBuilder.buildEmail(
            'reactivatedSubscription',
            this.opts
          )
          this.expectedUrl = `${this.settings.siteUrl}/user/subscription`
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("View Subscription Dashboard")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.expectedUrl)
          })
        })
      })

      describe('testEmail', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
          }
          this.email = this.EmailBuilder.buildEmail('testEmail', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom(
              `a:contains("Open ${this.settings.appName}")`
            )
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.settings.siteUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(this.settings.siteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(
              `Open ${this.settings.appName}: ${this.settings.siteUrl}`
            )
          })
        })
      })

      describe('registered', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            setNewPasswordUrl: `${this.settings.siteUrl}/user/activate?token=aToken123&user_id=aUserId123`,
          }
          this.email = this.EmailBuilder.buildEmail('registered', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("Set password")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(
              this.opts.setNewPasswordUrl
            )
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html().replace(/&amp;/, '&')
            expect(fallbackLink).to.contain(this.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.setNewPasswordUrl)
          })
        })
      })

      describe('projectInvite', function () {
        before(function () {
          this.emailAddress = 'example@overleaf.com'
          this.owner = {
            email: 'owner@example.com',
            name: 'Bailey',
          }
          this.projectName = 'Top Secret'
          this.opts = {
            inviteUrl: `${this.settings.siteUrl}/project/projectId123/invite/token/aToken123`,
            owner: {
              email: this.owner.email,
            },
            project: {
              name: this.projectName,
            },
            to: this.emailAddress,
          }
          this.email = this.EmailBuilder.buildEmail('projectInvite', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const dom = cheerio.load(this.email.html)
            const buttonLink = dom('a:contains("View project")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.inviteUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(this.opts.inviteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function () {
            expect(this.email.text).to.contain(this.opts.inviteUrl)
          })
        })
      })

      describe('welcome', function () {
        beforeEach(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
            confirmEmailUrl: `${this.settings.siteUrl}/user/emails/confirm?token=token123`,
          }
          this.email = this.EmailBuilder.buildEmail('welcome', this.opts)
          this.dom = cheerio.load(this.email.html)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function () {
            const buttonLink = this.dom('a:contains("Confirm Email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(this.opts.confirmEmailUrl)
            const fallback = this.dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            expect(fallback.html()).to.contain(this.opts.confirmEmailUrl)
          })
          it('should include help links', function () {
            const helpGuidesLink = this.dom('a:contains("Help Guides")')
            const templatesLink = this.dom('a:contains("Templates")')
            const logInLink = this.dom('a:contains("log in")')
            expect(helpGuidesLink.length).to.equal(1)
            expect(templatesLink.length).to.equal(1)
            expect(logInLink.length).to.equal(1)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA URL', function () {
            expect(this.email.text).to.contain(this.opts.confirmEmailUrl)
          })
          it('should include help URL', function () {
            expect(this.email.text).to.contain('/learn')
            expect(this.email.text).to.contain('/login')
            expect(this.email.text).to.contain('/templates')
          })
          it('should contain HTML links', function () {
            expect(this.email.text).to.not.contain('<a')
          })
        })
      })

      describe('groupSSODisabled', function () {
        it('should build the email for non managed and linked users', function () {
          const setNewPasswordUrl = `${this.settings.siteUrl}/user/password/reset`
          const emailAddress = 'example@overleaf.com'
          const opts = {
            to: emailAddress,
            setNewPasswordUrl,
            userIsManaged: false,
          }
          const email = this.EmailBuilder.buildEmail('groupSSODisabled', opts)
          expect(email.subject).to.equal(
            'A change to your Overleaf login options'
          )
          const dom = cheerio.load(email.html)
          expect(email.html).to.exist
          expect(email.html).to.contain(
            'Your group administrator has disabled single sign-on for your group.'
          )
          expect(email.html).to.contain(
            'You can still log in to Overleaf using one of our other'
          )
          const links = dom('a')
          expect(links[0].attribs.href).to.equal(
            `${this.settings.siteUrl}/login`
          )
          expect(links[1].attribs.href).to.equal(setNewPasswordUrl)
          expect(email.html).to.contain(
            "If you don't have a password, you can set one now."
          )
          expect(email.text).to.exist
          const expectedPlainText = [
            'Hi,',
            '',
            'Your group administrator has disabled single sign-on for your group.',
            '',
            '',
            '',
            'What does this mean for you?',
            '',
            'You can still log in to Overleaf using one of our other login options or with your email address and password.',
            '',
            "If you don't have a password, you can set one now.",
            '',
            `Set your new password: ${setNewPasswordUrl}`,
            '',
            '',
            '',
            'Regards,',
            `The ${this.settings.appName} Team - ${this.settings.siteUrl}`,
          ]
          expect(email.text.split(/\r?\n/)).to.deep.equal(expectedPlainText)
        })

        it('should build the email for managed and linked users', function () {
          const emailAddress = 'example@overleaf.com'
          const setNewPasswordUrl = `${this.settings.siteUrl}/user/password/reset`
          const opts = {
            to: emailAddress,
            setNewPasswordUrl,
            userIsManaged: true,
          }
          const email = this.EmailBuilder.buildEmail('groupSSODisabled', opts)
          expect(email.subject).to.equal(
            'Action required: Set your Overleaf password'
          )
          const dom = cheerio.load(email.html)
          expect(email.html).to.exist
          expect(email.html).to.contain(
            'Your group administrator has disabled single sign-on for your group.'
          )
          expect(email.html).to.contain(
            'You now need an email address and password to sign in to your Overleaf account.'
          )
          const links = dom('a')
          expect(links[0].attribs.href).to.equal(
            `${this.settings.siteUrl}/user/password/reset`
          )

          expect(email.text).to.exist

          const expectedPlainText = [
            'Hi,',
            '',
            'Your group administrator has disabled single sign-on for your group.',
            '',
            '',
            '',
            'What does this mean for you?',
            '',
            'You now need an email address and password to sign in to your Overleaf account.',
            '',
            `Set your new password: ${setNewPasswordUrl}`,
            '',
            '',
            '',
            'Regards,',
            `The ${this.settings.appName} Team - ${this.settings.siteUrl}`,
          ]

          expect(email.text.split(/\r?\n/)).to.deep.equal(expectedPlainText)
        })
      })
    })

    describe('no CTA', function () {
      describe('securityAlert', function () {
        before(function () {
          this.message = 'more details about the action'
          this.messageHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${this.message}</i></b></span>`
          this.messageNotAllowedHTML = `<div></div>${this.messageHTML}`

          this.actionDescribed = 'an action described'
          this.actionDescribedHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${this.actionDescribed}</i></b>`
          this.actionDescribedNotAllowedHTML = `<div></div>${this.actionDescribedHTML}`

          this.opts = {
            to: this.email,
            actionDescribed: this.actionDescribedNotAllowedHTML,
            action: 'an action',
            message: [this.messageNotAllowedHTML],
          }
          this.email = this.EmailBuilder.buildEmail('securityAlert', this.opts)
        })

        it('should build the email', function () {
          expect(this.email.html != null).to.equal(true)
          expect(this.email.text != null).to.equal(true)
        })

        describe('HTML email', function () {
          it('should clean HTML in opts.actionDescribed', function () {
            expect(this.email.html).to.not.contain(
              this.actionDescribedNotAllowedHTML
            )
            expect(this.email.html).to.contain(this.actionDescribedHTML)
          })
          it('should clean HTML in opts.message', function () {
            expect(this.email.html).to.not.contain(this.messageNotAllowedHTML)
            expect(this.email.html).to.contain(this.messageHTML)
          })
        })

        describe('plain text email', function () {
          it('should remove all HTML in opts.actionDescribed', function () {
            expect(this.email.text).to.not.contain(this.actionDescribedHTML)
            expect(this.email.text).to.contain(this.actionDescribed)
          })
          it('should remove all HTML in opts.message', function () {
            expect(this.email.text).to.not.contain(this.messageHTML)
            expect(this.email.text).to.contain(this.message)
          })
        })
      })

      describe('welcomeWithoutCTA', function () {
        beforeEach(function () {
          this.emailAddress = 'example@overleaf.com'
          this.opts = {
            to: this.emailAddress,
          }
          this.email = this.EmailBuilder.buildEmail(
            'welcomeWithoutCTA',
            this.opts
          )
          this.dom = cheerio.load(this.email.html)
        })

        it('should build the email', function () {
          expect(this.email.html).to.exist
          expect(this.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include help links', function () {
            const helpGuidesLink = this.dom('a:contains("Help Guides")')
            const templatesLink = this.dom('a:contains("Templates")')
            const logInLink = this.dom('a:contains("log in")')
            expect(helpGuidesLink.length).to.equal(1)
            expect(templatesLink.length).to.equal(1)
            expect(logInLink.length).to.equal(1)
          })
        })

        describe('plain text email', function () {
          it('should include help URL', function () {
            expect(this.email.text).to.contain('/learn')
            expect(this.email.text).to.contain('/login')
            expect(this.email.text).to.contain('/templates')
          })
          it('should contain HTML links', function () {
            expect(this.email.text).to.not.contain('<a')
          })
        })
      })
    })
  })
})
