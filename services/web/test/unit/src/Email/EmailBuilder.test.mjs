import { vi, expect } from 'vitest'
import cheerio from 'cheerio'
import path from 'node:path'

import EmailMessageHelper from '../../../../app/src/Features/Email/EmailMessageHelper.mjs'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/EmailBuilder'
)

describe('EmailBuilder', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      appName: 'testApp',
      siteUrl: 'https://www.overleaf.com',
      adminEmail: 'admin@overleaf.test',
    }

    vi.doMock('../../../../app/src/Features/Email/EmailMessageHelper', () => ({
      default: EmailMessageHelper,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.EmailBuilder = (await import(MODULE_PATH)).default
  })

  describe('projectInvite', function () {
    beforeEach(function (ctx) {
      ctx.opts = {
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
      beforeEach(function (ctx) {
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
      })

      it('should have html and text properties', function (ctx) {
        expect(ctx.email.html != null).to.equal(true)
        expect(ctx.email.text != null).to.equal(true)
      })

      it('should not have undefined in it', function (ctx) {
        ctx.email.html.indexOf('undefined').should.equal(-1)
        ctx.email.subject.indexOf('undefined').should.equal(-1)
      })
    })

    describe('when dealing with escaping', function () {
      it("should not show possessive 's as &#39;", function (ctx) {
        ctx.opts.project.name = "Aktöbe's project"
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
        expect(ctx.email.subject).to.not.contain('&#39;')
        expect(ctx.email.subject).to.contain(ctx.opts.project.name)
      })

      it('should not show an ampersand as &amp;', function (ctx) {
        ctx.opts.project.name = 'Aktöbe & Almaty project'
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
        expect(ctx.email.subject).to.not.contain('&amp;')
        expect(ctx.email.subject).to.contain(ctx.opts.project.name)
      })

      it('should prevent dangerous characters as project names', function (ctx) {
        const characters = ['""', '<>', '//']
        for (const pair of characters) {
          ctx.opts.project.name = `${pair} project`
          ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
          expect(ctx.email.subject).to.not.contain(pair)
        }
      })
    })

    describe('when someone is up to no good', function () {
      it('should not contain the project name at all if unsafe', function (ctx) {
        ctx.opts.project.name = "<img src='http://evilsite.com/evil.php'>"
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
        expect(ctx.email.html).to.not.contain('evilsite.com')
        expect(ctx.email.subject).to.not.contain('evilsite.com')

        // but email should appear
        expect(ctx.email.html).to.contain(ctx.opts.owner.email)
        expect(ctx.email.subject).to.contain(ctx.opts.owner.email)
      })

      it('should not contain the inviter email at all if unsafe', function (ctx) {
        ctx.opts.owner.email =
          'verylongemailaddressthatwillfailthecheck@longdomain.domain'
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)

        expect(ctx.email.html).to.not.contain(ctx.opts.owner.email)
        expect(ctx.email.subject).to.not.contain(ctx.opts.owner.email)

        // but title should appear
        expect(ctx.email.html).to.contain(ctx.opts.project.name)
        expect(ctx.email.subject).to.contain(ctx.opts.project.name)
      })

      it('should handle both email and title being unsafe', function (ctx) {
        ctx.opts.project.name = "<img src='http://evilsite.com/evil.php'>"
        ctx.opts.owner.email =
          'verylongemailaddressthatwillfailthecheck@longdomain.domain'
        ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)

        expect(ctx.email.html).to.not.contain('evilsite.com')
        expect(ctx.email.subject).to.not.contain('evilsite.com')
        expect(ctx.email.html).to.not.contain(ctx.opts.owner.email)
        expect(ctx.email.subject).to.not.contain(ctx.opts.owner.email)

        expect(ctx.email.html).to.contain(
          'Please view the project to find out more'
        )
      })
    })
  })

  describe('SpamSafe', function () {
    beforeEach(function (ctx) {
      ctx.opts = {
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
      ctx.email = ctx.EmailBuilder.buildEmail(
        'ownershipTransferConfirmationPreviousOwner',
        ctx.opts
      )
    })

    it('should replace spammy project name', function (ctx) {
      ctx.email.html.indexOf('your project').should.not.equal(-1)
    })
  })

  describe('gitTokenExpiringSoon', function () {
    beforeEach(function (ctx) {
      ctx.opts = {
        to: 'user@example.com',
      }
      ctx.email = ctx.EmailBuilder.buildEmail('gitTokenExpiringSoon', ctx.opts)
    })

    it('should render html, text, and subject without undefined', function (ctx) {
      expect(ctx.email.html).to.not.be.undefined
      expect(ctx.email.text).to.not.be.undefined
      expect(ctx.email.subject).to.not.be.undefined
      ctx.email.html.indexOf('undefined').should.equal(-1)
      ctx.email.text.indexOf('undefined').should.equal(-1)
      ctx.email.subject.indexOf('undefined').should.equal(-1)
    })

    it('should link the CTA to user settings', function (ctx) {
      ctx.email.text.should.contain(`${ctx.settings.siteUrl}/user/settings`)
    })
  })

  describe('gitTokenExpired', function () {
    beforeEach(function (ctx) {
      ctx.opts = {
        to: 'user@example.com',
      }
      ctx.email = ctx.EmailBuilder.buildEmail('gitTokenExpired', ctx.opts)
    })

    it('should render html, text, and subject without undefined', function (ctx) {
      expect(ctx.email.html).to.not.be.undefined
      expect(ctx.email.text).to.not.be.undefined
      expect(ctx.email.subject).to.not.be.undefined
      ctx.email.html.indexOf('undefined').should.equal(-1)
      ctx.email.text.indexOf('undefined').should.equal(-1)
      ctx.email.subject.indexOf('undefined').should.equal(-1)
    })

    it('should link the CTA to user settings', function (ctx) {
      ctx.email.text.should.contain(`${ctx.settings.siteUrl}/user/settings`)
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
      it('should throw an error when missing title', function (ctx) {
        const { title, ...missing } = content
        expect(() => {
          ctx.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing message', function (ctx) {
        const { message, ...missing } = content
        expect(() => {
          ctx.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaText', function (ctx) {
        const { ctaText, ...missing } = content
        expect(() => {
          ctx.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
      it('should throw an error when missing ctaURL', function (ctx) {
        const { ctaURL, ...missing } = content
        expect(() => {
          ctx.EmailBuilder.ctaTemplate(missing)
        }).to.throw(Error)
      })
    })

    describe('footerMessage', function () {
      it('should default footerMessage to undefined when not provided', function (ctx) {
        const template = ctx.EmailBuilder.ctaTemplate({
          subject: () => 'Subject',
          message: () => ['Message'],
          ctaText: () => 'Click',
          ctaURL: () => 'https://example.com',
        })
        expect(template.footerMessage({})).to.be.undefined
      })

      it('should use the provided footerMessage callback', function (ctx) {
        const template = ctx.EmailBuilder.ctaTemplate({
          subject: () => 'Subject',
          message: () => ['Message'],
          ctaText: () => 'Click',
          ctaURL: () => 'https://example.com',
          footerMessage: () => 'Custom footer text',
        })
        expect(template.footerMessage({})).to.equal('Custom footer text')
      })

      it('should include footerMessage in plain text output when provided', function (ctx) {
        ctx.EmailBuilder.templates.testFooterTemplate =
          ctx.EmailBuilder.ctaTemplate({
            subject: () => 'Test Subject',
            message: () => ['Body message'],
            ctaText: () => 'Go',
            ctaURL: () => 'https://example.com',
            footerMessage: (opts, isPlainText) =>
              isPlainText ? 'Plain footer' : '<b>HTML footer</b>',
          })
        const email = ctx.EmailBuilder.buildEmail('testFooterTemplate', {
          to: 'test@example.com',
        })
        expect(email.text).to.contain('Plain footer')
        delete ctx.EmailBuilder.templates.testFooterTemplate
      })
    })
  })

  describe('templates', function () {
    describe('CTA', function () {
      describe('canceledSubscription', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'canceledSubscription',
            ctx.opts
          )
          ctx.expectedUrl =
            'https://docs.google.com/forms/d/e/1FAIpQLSfa7z_s-cucRRXm70N4jEcSbFsZeb0yuKThHGQL8ySEaQzF0Q/viewform?usp=sf_link'
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Leave feedback")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('canceledSubscriptionOrAddOn', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'canceledSubscriptionOrAddOn',
            ctx.opts
          )
          ctx.expectedUrl =
            'https://digitalscience.qualtrics.com/jfe/form/SV_2n2aSlWgvoxXdGK'
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Leave feedback")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('ownershipTransferConfirmationNewOwner', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            previousOwner: {},
            project: {
              _id: 'abc123',
              name: 'example project',
            },
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'ownershipTransferConfirmationNewOwner',
            ctx.opts
          )
          ctx.expectedUrl = `${
            ctx.settings.siteUrl
          }/project/${ctx.opts.project._id.toString()}`
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("View project")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('passwordResetRequested', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            setNewPasswordUrl: `${
              ctx.settings.siteUrl
            }/user/password/set?passwordResetToken=aToken&email=${encodeURIComponent(
              ctx.emailAddress
            )}`,
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'passwordResetRequested',
            ctx.opts
          )
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Reset password")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.setNewPasswordUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })
      })

      describe('verifyEmailToJoinTeam', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            acceptInviteUrl: `${ctx.settings.siteUrl}/subscription/invites/aToken123/`,
            inviter: {
              email: 'deanna@overleaf.com',
              first_name: 'Deanna',
              last_name: 'Troi',
            },
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'verifyEmailToJoinTeam',
            ctx.opts
          )
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Join now")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.acceptInviteUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.opts.acceptInviteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.acceptInviteUrl)
          })
        })
      })

      describe('reactivatedSubscription', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'reactivatedSubscription',
            ctx.opts
          )
          ctx.expectedUrl = `${ctx.settings.siteUrl}/user/subscription`
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("View Subscription Dashboard")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('testEmail', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('testEmail', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom(`a:contains("Open ${ctx.settings.appName}")`)
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.settings.siteUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.settings.siteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(
              `Open ${ctx.settings.appName}: ${ctx.settings.siteUrl}`
            )
          })
        })
      })

      describe('registered', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            setNewPasswordUrl: `${ctx.settings.siteUrl}/user/activate?token=aToken123&user_id=aUserId123`,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('registered', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Set password")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.setNewPasswordUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })
      })

      describe('projectInvite', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.owner = {
            email: 'owner@example.com',
            name: 'Bailey',
          }
          ctx.projectName = 'Top Secret'
          ctx.opts = {
            inviteUrl: `${ctx.settings.siteUrl}/project/projectId123/invite/token/aToken123`,
            owner: {
              email: ctx.owner.email,
            },
            project: {
              name: ctx.projectName,
            },
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('projectInvite', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("View project")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.inviteUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.opts.inviteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.inviteUrl)
          })
        })
      })

      describe('groupSSODisabled', function () {
        it('should build the email for non managed and linked users', function (ctx) {
          const setNewPasswordUrl = `${ctx.settings.siteUrl}/user/password/reset`
          const emailAddress = 'example@overleaf.com'
          const opts = {
            to: emailAddress,
            setNewPasswordUrl,
            userIsManaged: false,
          }
          const email = ctx.EmailBuilder.buildEmail('groupSSODisabled', opts)
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
          const loginLink = dom('a:contains("login options")')
          expect(loginLink.attr('href')).to.equal(
            `${ctx.settings.siteUrl}/login`
          )
          const passwordLink = dom('a:contains("Set your new password")')
          expect(passwordLink.attr('href')).to.equal(setNewPasswordUrl)
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
            `The ${ctx.settings.appName} Team - ${ctx.settings.siteUrl}`,
          ]
          expect(email.text.split(/\r?\n/)).to.deep.equal(expectedPlainText)
        })

        it('should build the email for managed and linked users', function (ctx) {
          const emailAddress = 'example@overleaf.com'
          const setNewPasswordUrl = `${ctx.settings.siteUrl}/user/password/reset`
          const opts = {
            to: emailAddress,
            setNewPasswordUrl,
            userIsManaged: true,
          }
          const email = ctx.EmailBuilder.buildEmail('groupSSODisabled', opts)
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
          const ctaLink = dom('a:contains("Set your new password")')
          expect(ctaLink.attr('href')).to.equal(
            `${ctx.settings.siteUrl}/user/password/reset`
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
            `The ${ctx.settings.appName} Team - ${ctx.settings.siteUrl}`,
          ]

          expect(email.text.split(/\r?\n/)).to.deep.equal(expectedPlainText)
        })
      })
    })

    describe('no CTA', function () {
      describe('securityAlert', function () {
        beforeEach(function (ctx) {
          ctx.message = 'more details about the action'
          ctx.messageHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${ctx.message}</i></b></span>`
          ctx.messageNotAllowedHTML = `<div></div>${ctx.messageHTML}`

          ctx.actionDescribed = 'an action described'
          ctx.actionDescribedHTML = `<br /><span style="text-align:center" class="a-class"><b><i>${ctx.actionDescribed}</i></b>`
          ctx.actionDescribedNotAllowedHTML = `<div></div>${ctx.actionDescribedHTML}`

          ctx.opts = {
            to: ctx.email,
            actionDescribed: ctx.actionDescribedNotAllowedHTML,
            action: 'an action',
            message: [ctx.messageNotAllowedHTML],
          }
          ctx.email = ctx.EmailBuilder.buildEmail('securityAlert', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html != null).to.equal(true)
          expect(ctx.email.text != null).to.equal(true)
        })

        describe('HTML email', function () {
          it('should clean HTML in opts.actionDescribed', function (ctx) {
            expect(ctx.email.html).to.not.contain(
              ctx.actionDescribedNotAllowedHTML
            )
            expect(ctx.email.html).to.contain(ctx.actionDescribedHTML)
          })
          it('should clean HTML in opts.message', function (ctx) {
            expect(ctx.email.html).to.not.contain(ctx.messageNotAllowedHTML)
            expect(ctx.email.html).to.contain(ctx.messageHTML)
          })
        })

        describe('plain text email', function () {
          it('should remove all HTML in opts.actionDescribed', function (ctx) {
            expect(ctx.email.text).to.not.contain(ctx.actionDescribedHTML)
            expect(ctx.email.text).to.contain(ctx.actionDescribed)
          })
          it('should remove all HTML in opts.message', function (ctx) {
            expect(ctx.email.text).to.not.contain(ctx.messageHTML)
            expect(ctx.email.text).to.contain(ctx.message)
          })
        })
      })

      describe('welcomeWithoutCTA', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('welcomeWithoutCTA', ctx.opts)
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include help links', function (ctx) {
            const helpGuidesLink = ctx.dom('a:contains("Help Guides")')
            const templatesLink = ctx.dom('a:contains("Templates")')
            const logInLink = ctx.dom('a:contains("log in")')
            expect(helpGuidesLink.length).to.equal(1)
            expect(templatesLink.length).to.equal(1)
            expect(logInLink.length).to.equal(1)
          })
        })

        describe('plain text email', function () {
          it('should include help URL', function (ctx) {
            expect(ctx.email.text).to.contain('/learn')
            expect(ctx.email.text).to.contain('/login')
            expect(ctx.email.text).to.contain('/templates')
          })
          it('should contain HTML links', function (ctx) {
            expect(ctx.email.text).to.not.contain('<a')
          })
        })
      })

      describe('removeGroupMember', function () {
        beforeEach(function (ctx) {
          ctx.passwordResetUrl = `${ctx.settings.siteUrl}/user/password/reset`
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            adminName: 'abcdef',
          }
          ctx.email = ctx.EmailBuilder.buildEmail('removeGroupMember', ctx.opts)
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include links', function (ctx) {
            const resetPasswordLink = ctx.dom('a:contains("set a password")')
            expect(resetPasswordLink.length).to.equal(1)
            expect(resetPasswordLink.attr('href')).to.equal(
              ctx.passwordResetUrl
            )
          })
        })

        describe('plain text email', function () {
          it('should include URLs', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.passwordResetUrl)
          })
        })
      })

      describe('taxExemptCertificateRequired', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'customer@example.com'
          ctx.opts = {
            to: ctx.emailAddress,
            ein: '12-3456789',
            stripeCustomerId: 'cus_123456789',
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'taxExemptCertificateRequired',
            ctx.opts
          )
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include the EIN', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.ein)
          })

          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should include tax exemption verification text', function (ctx) {
            expect(ctx.email.html).to.contain('tax exempt')
            expect(ctx.email.html).to.contain('verification')
          })
        })

        describe('plain text email', function () {
          it('should include the EIN', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.ein)
          })

          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should include tax exemption verification text', function (ctx) {
            expect(ctx.email.text).to.contain('tax exempt')
            expect(ctx.email.text).to.contain('verification')
          })
        })
      })

      describe('taxIdInvalidVat', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'customer@example.com'
          ctx.opts = {
            to: ctx.emailAddress,
            stripeCustomerId: 'cus_123456789',
          }
          ctx.email = ctx.EmailBuilder.buildEmail('taxIdInvalidVat', ctx.opts)
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should refer to the VAT number', function (ctx) {
            expect(ctx.email.html).to.contain('VAT number')
          })

          it('should link to the subscription page', function (ctx) {
            expect(ctx.dom('a').attr('href')).to.contain('/user/subscription')
          })
        })

        describe('plain text email', function () {
          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should refer to the VAT number', function (ctx) {
            expect(ctx.email.text).to.contain('VAT number')
          })
        })
      })

      describe('taxIdInvalidNonVat', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'customer@example.com'
          ctx.opts = {
            to: ctx.emailAddress,
            stripeCustomerId: 'cus_123456789',
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'taxIdInvalidNonVat',
            ctx.opts
          )
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should refer to the tax ID', function (ctx) {
            expect(ctx.email.html).to.contain('tax ID')
          })

          it('should link to the subscription page', function (ctx) {
            expect(ctx.dom('a').attr('href')).to.contain('/user/subscription')
          })
        })

        describe('plain text email', function () {
          it('should include the Stripe customer ID', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.stripeCustomerId)
          })

          it('should refer to the tax ID', function (ctx) {
            expect(ctx.email.text).to.contain('tax ID')
          })
        })
      })

      describe('groupMemberLimitWarning', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            groupName: 'Example Group',
            firstName: 'Joe',
            currentMembers: 9,
            membersLimit: 10,
            remainingSeats: 1,
          }
          ctx.email = ctx.EmailBuilder.buildEmail(
            'groupMemberLimitWarning',
            ctx.opts
          )
          ctx.expectedUrl = `${ctx.settings.siteUrl}/user/subscription/group/add-users`
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const plainText = dom.text()
            expect(ctx.email.subject).to.equal(
              'Action needed: Your Overleaf group is nearly out of licenses'
            )
            expect(ctx.email.html).to.exist
            expect(ctx.email.html).to.contain(
              `Your Overleaf group <b>${ctx.opts.groupName}</b> is close to its license limit.`
            )
            expect(plainText).to.contain(
              `${ctx.opts.currentMembers} of ${ctx.opts.membersLimit} ` +
                `licenses are in use (${ctx.opts.remainingSeats} remaining).`
            )
            expect(ctx.email.html).to.contain(
              'Because domain capture is enabled, users from your domain ' +
                'can join automatically via SSO.'
            )
            expect(ctx.email.html).to.contain(
              'Once all licenses are used, new users won’t be able to join.'
            )
            expect(ctx.email.html).to.contain('What you can do now:')
            expect(ctx.email.html).to.contain('Add more licenses, or')
            expect(ctx.email.html).to.contain(
              'Remove inactive users to free up licenses'
            )
            const buttonLink = dom('a:contains("Add licenses")')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            expect(ctx.email.html).to.contain('copy and paste this link')
            expect(ctx.email.html).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('groupDomainCapturedByGroupChanged', function () {
        it('should build active-domain-capture email', function (ctx) {
          const email = ctx.EmailBuilder.buildEmail(
            'groupDomainCapturedByGroupChanged',
            {
              to: 'admin@example.com',
              groupId: 'group-123',
              domainCapturedByGroup: true,
              domain: 'example.com',
            }
          )

          expect(email.subject).to.equal(
            'Domain capture now active for example.com'
          )
          expect(email.html).to.contain(
            'Domain capture is active for example.com'
          )
          expect(email.html).to.contain('/manage/groups/group-123/settings')
          expect(email.text).to.contain('/manage/groups/group-123/settings')
        })

        it('should build inactive-domain-capture email including support contact', function (ctx) {
          const email = ctx.EmailBuilder.buildEmail(
            'groupDomainCapturedByGroupChanged',
            {
              to: 'admin@example.com',
              groupId: 'group-123',
              domainCapturedByGroup: false,
              domain: 'example.com',
            }
          )

          expect(email.subject).to.equal(
            'Domain capture now inactive for example.com'
          )
          expect(email.html).to.contain(
            'Domain capture is inactive for example.com'
          )
          expect(email.html).to.contain('admin@overleaf.test')
          expect(email.text).to.contain('admin@overleaf.test')
        })
      })

      describe('domainVerifiedForGroup', function () {
        it('should build captured-by-group variant', function (ctx) {
          const email = ctx.EmailBuilder.buildEmail('domainVerifiedForGroup', {
            to: 'admin@example.com',
            domain: 'example.com',
            capturedByGroup: true,
          })

          expect(email.subject).to.equal('Your domain is verified')
          expect(email.html).to.contain("We've verified")
          expect(email.html).to.contain('<b>example.com</b>')
          expect(email.html).to.contain(
            'Your group will continue capturing users with this domain.'
          )
        })

        it('should build not-captured variant with support instructions', function (ctx) {
          const email = ctx.EmailBuilder.buildEmail('domainVerifiedForGroup', {
            to: 'admin@example.com',
            domain: 'example.com',
            capturedByGroup: false,
          })

          expect(email.subject).to.equal(
            'Your domain is verified — ready to capture?'
          )
          expect(email.html).to.contain(
            "To complete the capture, reply to this email and we'll take it from there."
          )
          expect(email.html).to.contain(
            "You'll receive a confirmation email once the capture is active."
          )
        })
      })

      describe('domainReverificationFailed', function () {
        beforeEach(function (ctx) {
          ctx.opts = {
            to: 'admin@example.com',
            domain: 'example.com',
            domainSettingsUrl:
              'https://www.overleaf.com/manage/groups/abc/settings',
          }
        })

        describe('when the domain is captured by the group', function () {
          beforeEach(function (ctx) {
            ctx.opts.capturedByGroup = true
            // local-time date so moment's local formatting is timezone-safe
            ctx.opts.gracePeriodEndDate = new Date(2026, 5, 30)
            ctx.email = ctx.EmailBuilder.buildEmail(
              'domainReverificationFailed',
              ctx.opts
            )
          })

          it('builds html and text without undefined', function (ctx) {
            expect(ctx.email.html).to.exist
            expect(ctx.email.text).to.exist
            expect(ctx.email.html.indexOf('undefined')).to.equal(-1)
            expect(ctx.email.subject.indexOf('undefined')).to.equal(-1)
          })

          it('leads with action needed and the domain in the subject', function (ctx) {
            expect(ctx.email.subject).to.equal(
              'Action needed: re-verify example.com to keep adding users automatically'
            )
          })

          it('includes the grace period deadline', function (ctx) {
            expect(ctx.email.html).to.contain('June 30, 2026')
            expect(ctx.email.html).to.contain("we'll stop adding them")
          })

          it('links to the domain settings page', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.domainSettingsUrl)
            expect(ctx.email.text).to.contain(ctx.opts.domainSettingsUrl)
          })
        })

        describe('when the domain is not captured by the group', function () {
          beforeEach(function (ctx) {
            ctx.opts.capturedByGroup = false
            ctx.email = ctx.EmailBuilder.buildEmail(
              'domainReverificationFailed',
              ctx.opts
            )
          })

          it('uses the lower-stakes subject', function (ctx) {
            expect(ctx.email.subject).to.equal('example.com needs re-verifying')
          })

          it('does not mention a deadline or capture', function (ctx) {
            expect(ctx.email.html).to.not.contain("we'll stop adding them")
            expect(ctx.email.html.indexOf('undefined')).to.equal(-1)
          })

          it('still links to the domain settings page', function (ctx) {
            expect(ctx.email.html).to.contain(ctx.opts.domainSettingsUrl)
          })
        })

        // The cta-email title and body are lodash templates, where <%= %>
        // interpolates without escaping (the opposite of EJS), so the domain must
        // be escaped in both title() and message(). The domain regex makes such
        // input impossible in practice, but this guards the escaping against being
        // applied zero or two times. (a&b.example.com appears in both the title and
        // the body, so we expect two single-escaped occurrences and none
        // double-escaped.)
        it('escapes the domain exactly once in the title and body', function (ctx) {
          ctx.opts.capturedByGroup = false
          ctx.opts.domain = 'a&b.example.com'
          ctx.email = ctx.EmailBuilder.buildEmail(
            'domainReverificationFailed',
            ctx.opts
          )
          expect(ctx.email.html.split('a&amp;b.example.com')).to.have.lengthOf(
            3
          )
          expect(ctx.email.html).to.not.contain('a&amp;amp;b.example.com')
        })
      })
    })
  })
})
