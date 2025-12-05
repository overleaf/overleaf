import { vi, expect } from 'vitest'
import cheerio from 'cheerio'
import path from 'node:path'

import EmailMessageHelper from '../../../../app/src/Features/Email/EmailMessageHelper.mjs'
import ctaEmailBody from '../../../../app/src/Features/Email/Bodies/cta-email.mjs'
import NoCTAEmailBody from '../../../../app/src/Features/Email/Bodies/NoCTAEmailBody.mjs'
import BaseWithHeaderEmailLayout from '../../../../app/src/Features/Email/Layouts/BaseWithHeaderEmailLayout.mjs'

const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Email/EmailBuilder'
)

describe('EmailBuilder', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      appName: 'testApp',
      siteUrl: 'https://www.overleaf.com',
    }

    vi.doMock('../../../../app/src/Features/Email/EmailMessageHelper', () => ({
      default: EmailMessageHelper,
    }))

    vi.doMock('../../../../app/src/Features/Email/Bodies/cta-email', () => ({
      default: ctaEmailBody,
    }))

    vi.doMock(
      '../../../../app/src/Features/Email/Bodies/NoCTAEmailBody',
      () => ({
        default: NoCTAEmailBody,
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Email/Layouts/BaseWithHeaderEmailLayout',
      () => ({
        default: BaseWithHeaderEmailLayout,
      })
    )

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
            const buttonLink = dom('a:contains("Leave Feedback")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.expectedUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })

      describe('confirmEmail', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.userId = 'abc123'
          ctx.opts = {
            to: ctx.emailAddress,
            confirmEmailUrl: `${ctx.settings.siteUrl}/user/emails/confirm?token=aToken123`,
            sendingUser_id: ctx.userId,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('confirmEmail', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Confirm email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.confirmEmailUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.opts.confirmEmailUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.confirmEmailUrl)
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
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(ctx.expectedUrl)
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
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(ctx.opts.setNewPasswordUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.setNewPasswordUrl)
          })
        })
      })

      describe('reconfirmEmail', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.userId = 'abc123'
          ctx.opts = {
            to: ctx.emailAddress,
            confirmEmailUrl: `${ctx.settings.siteUrl}/user/emails/confirm?token=aToken123`,
            sendingUser_id: ctx.userId,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('reconfirmEmail', ctx.opts)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const dom = cheerio.load(ctx.email.html)
            const buttonLink = dom('a:contains("Reconfirm Email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.confirmEmailUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.opts.confirmEmailUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.confirmEmailUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.opts.acceptInviteUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.expectedUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html()
            expect(fallbackLink).to.contain(ctx.settings.siteUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html().replace(/&amp;/, '&')
            expect(fallbackLink).to.contain(ctx.opts.setNewPasswordUrl)
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
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(ctx.opts.inviteUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.inviteUrl)
          })
        })
      })

      describe('welcome', function () {
        beforeEach(function (ctx) {
          ctx.emailAddress = 'example@overleaf.com'
          ctx.opts = {
            to: ctx.emailAddress,
            confirmEmailUrl: `${ctx.settings.siteUrl}/user/emails/confirm?token=token123`,
          }
          ctx.email = ctx.EmailBuilder.buildEmail('welcome', ctx.opts)
          ctx.dom = cheerio.load(ctx.email.html)
        })

        it('should build the email', function (ctx) {
          expect(ctx.email.html).to.exist
          expect(ctx.email.text).to.exist
        })

        describe('HTML email', function () {
          it('should include a CTA button and a fallback CTA link', function (ctx) {
            const buttonLink = ctx.dom('a:contains("Confirm email")')
            expect(buttonLink.length).to.equal(1)
            expect(buttonLink.attr('href')).to.equal(ctx.opts.confirmEmailUrl)
            const fallback = ctx.dom('.force-overleaf-style').last()
            expect(fallback.length).to.equal(1)
            expect(fallback.html()).to.contain(ctx.opts.confirmEmailUrl)
          })
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
          it('should contain the CTA URL', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.opts.confirmEmailUrl)
          })
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
          const links = dom('a')
          expect(links[0].attribs.href).to.equal(
            `${ctx.settings.siteUrl}/login`
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
          const links = dom('a')
          expect(links[0].attribs.href).to.equal(
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
              `${ctx.opts.groupName} is approaching its member limit`
            )
            expect(ctx.email.html).to.exist
            expect(ctx.email.html).to.contain(
              `Your group "${ctx.opts.groupName}" is approaching its member limit.`
            )
            expect(plainText).to.contain(
              `Current usage: ${ctx.opts.currentMembers} of ` +
                `${ctx.opts.membersLimit} licenses used ` +
                `(${ctx.opts.remainingSeats} remaining)`
            )
            expect(ctx.email.html).to.contain(
              'With domain capture enabled, users with verified email ' +
                'addresses from your domain can automatically join the group ' +
                'via SSO. Once the member limit is reached, new users will ' +
                'be blocked from joining.'
            )
            expect(ctx.email.html).to.contain(
              'To ensure uninterrupted access for your users, consider ' +
                'adding more licenses or removing inactive members.'
            )
            const buttonLink = dom('td a')
            expect(buttonLink).to.exist
            expect(buttonLink.attr('href')).to.equal(ctx.expectedUrl)
            const fallback = dom('.force-overleaf-style').last()
            expect(fallback).to.exist
            const fallbackLink = fallback.html().replace(/&amp;/g, '&')
            expect(fallbackLink).to.contain(ctx.expectedUrl)
          })
        })

        describe('plain text email', function () {
          it('should contain the CTA link', function (ctx) {
            expect(ctx.email.text).to.contain(ctx.expectedUrl)
          })
        })
      })
    })
  })
})
