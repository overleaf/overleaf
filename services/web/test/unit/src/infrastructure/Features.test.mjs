import { vi, expect } from 'vitest'
const modulePath = '../../../../app/src/infrastructure/Features.mjs'

describe('Features', function () {
  beforeEach(async function (ctx) {
    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        moduleImportSequence: [],
        enabledLinkedFileTypes: [],
      }),
    }))

    ctx.Features = (await import(modulePath)).default
  })
  describe('externalAuthenticationSystemUsed', function () {
    describe('without any settings', function () {
      it('should return false', function (ctx) {
        expect(ctx.Features.externalAuthenticationSystemUsed()).to.be.false
      })
    })
    describe('with ldap setting', function () {
      beforeEach(function (ctx) {
        ctx.settings.ldap = { enable: true }
      })
      it('should return true', function (ctx) {
        expect(ctx.Features.externalAuthenticationSystemUsed()).to.be.true
      })
    })
    describe('with saml setting', function () {
      beforeEach(function (ctx) {
        ctx.settings.saml = { enable: true }
      })
      it('should return true', function (ctx) {
        expect(ctx.Features.externalAuthenticationSystemUsed()).to.be.true
      })
    })
    describe('with oauth setting', function () {
      beforeEach(function (ctx) {
        ctx.settings.overleaf = { oauth: true }
      })
      it('should return true', function (ctx) {
        expect(ctx.Features.externalAuthenticationSystemUsed()).to.be.true
      })
    })
  })

  describe('hasFeature', function () {
    describe('without any settings', function () {
      it('should return true', function (ctx) {
        expect(ctx.Features.hasFeature('registration-page')).to.be.true
      })
      it('should return false', function (ctx) {
        expect(ctx.Features.hasFeature('registration')).to.be.false
        expect(ctx.Features.hasFeature('affiliations')).to.be.false
        expect(ctx.Features.hasFeature('analytics')).to.be.false
        expect(ctx.Features.hasFeature('git-bridge')).to.be.false
        expect(ctx.Features.hasFeature('github-sync')).to.be.false
        expect(ctx.Features.hasFeature('homepage')).to.be.false
        expect(ctx.Features.hasFeature('link-url')).to.be.false
        expect(ctx.Features.hasFeature('oauth')).to.be.false
        expect(ctx.Features.hasFeature('saas')).to.be.false
        expect(ctx.Features.hasFeature('references')).to.be.false
        expect(ctx.Features.hasFeature('saml')).to.be.false
        expect(ctx.Features.hasFeature('templates-server-pro')).to.be.false
      })
    })
    describe('with settings', function () {
      describe('empty overleaf object', function () {
        beforeEach(function (ctx) {
          ctx.settings.overleaf = {}
          ctx.settings.apis = {}
        })
        it('should return true', function (ctx) {
          expect(ctx.Features.hasFeature('saas')).to.be.true
          expect(ctx.Features.hasFeature('registration')).to.be.true
        })
        it('should return false', function (ctx) {
          expect(ctx.Features.hasFeature('affiliations')).to.be.false
          expect(ctx.Features.hasFeature('analytics')).to.be.false
          expect(ctx.Features.hasFeature('git-bridge')).to.be.false
          expect(ctx.Features.hasFeature('github-sync')).to.be.false
          expect(ctx.Features.hasFeature('homepage')).to.be.false
          expect(ctx.Features.hasFeature('link-url')).to.be.false
          expect(ctx.Features.hasFeature('oauth')).to.be.false
          expect(ctx.Features.hasFeature('references')).to.be.false
          expect(ctx.Features.hasFeature('saml')).to.be.false
          expect(ctx.Features.hasFeature('templates-server-pro')).to.be.false
        })
        describe('with APIs', function () {
          beforeEach(function (ctx) {
            ctx.settings.apis = {
              linkedUrlProxy: {
                url: 'https://www.overleaf.com',
              },
              references: {
                url: 'https://www.overleaf.com',
              },
              v1: {
                url: 'https://www.overleaf.com',
              },
            }
          })
          it('should return true', function (ctx) {
            expect(ctx.Features.hasFeature('affiliations')).to.be.true
            expect(ctx.Features.hasFeature('analytics')).to.be.true
            expect(ctx.Features.hasFeature('saas')).to.be.true
            expect(ctx.Features.hasFeature('references')).to.be.true
            expect(ctx.Features.hasFeature('registration')).to.be.true
          })
          it('should return false', function (ctx) {
            expect(ctx.Features.hasFeature('link-url')).to.be.false
            expect(ctx.Features.hasFeature('git-bridge')).to.be.false
            expect(ctx.Features.hasFeature('github-sync')).to.be.false
            expect(ctx.Features.hasFeature('homepage')).to.be.false
            expect(ctx.Features.hasFeature('oauth')).to.be.false
            expect(ctx.Features.hasFeature('saml')).to.be.false
            expect(ctx.Features.hasFeature('templates-server-pro')).to.be.false
          })
          describe('with all other settings flags', function () {
            beforeEach(function (ctx) {
              ctx.settings.enableHomepage = true
              ctx.settings.enableGitBridge = true
              ctx.settings.enableGithubSync = true
              ctx.settings.enableSaml = true
              ctx.settings.oauth = true
              ctx.settings.enabledLinkedFileTypes = ['url', 'project_file']
            })
            it('should return true or return value', function (ctx) {
              expect(ctx.Features.hasFeature('link-url')).to.be.true
              expect(ctx.Features.hasFeature('affiliations')).to.be.true
              expect(ctx.Features.hasFeature('analytics')).to.be.true
              expect(ctx.Features.hasFeature('github-sync')).to.be.true
              expect(ctx.Features.hasFeature('git-bridge')).to.be.true
              expect(ctx.Features.hasFeature('homepage')).to.be.true
              expect(ctx.Features.hasFeature('link-url')).to.be.true
              expect(ctx.Features.hasFeature('oauth')).to.be.true
              expect(ctx.Features.hasFeature('saas')).to.be.true
              expect(ctx.Features.hasFeature('references')).to.be.true
              expect(ctx.Features.hasFeature('registration')).to.be.true
              expect(ctx.Features.hasFeature('saml')).to.be.true
            })
            it('should return false', function (ctx) {
              expect(ctx.Features.hasFeature('templates-server-pro')).to.be
                .false
            })
          })
        })
      })
    })
  })
})
