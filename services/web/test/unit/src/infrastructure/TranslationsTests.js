const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')

const MODULE_PATH = '../../../../app/src/infrastructure/Translations.js'

describe('Translations', function() {
  beforeEach(function() {
    this.translations = SandboxedModule.require(MODULE_PATH, {
      requires: {
        'settings-sharelatex': {
          i18n: {
            subdomainLang: {
              www: { lngCode: 'en', url: 'www.sharelatex.com' },
              fr: { lngCode: 'fr', url: 'fr.sharelatex.com' },
              da: { lngCode: 'da', url: 'da.sharelatex.com' }
            }
          }
        }
      }
    })

    this.req = {
      originalUrl: "doesn'tmatter.sharelatex.com/login",
      headers: {
        'accept-language': ''
      }
    }
    this.res = {
      getHeader: () => {},
      setHeader: () => {}
    }
  })

  describe('translate', function() {
    beforeEach(function(done) {
      this.req.url = 'www.sharelatex.com/login'
      this.translations.expressMiddleware(this.req, this.res, done)
    })

    it('works', function() {
      expect(this.req.i18n.t('give_feedback')).to.equal('Give feedback')
    })

    it('has translate alias', function() {
      expect(this.req.i18n.translate('give_feedback')).to.equal('Give feedback')
    })
  })

  describe('interpolation', function() {
    beforeEach(function(done) {
      this.req.url = 'www.sharelatex.com/login'
      this.translations.expressMiddleware(this.req, this.res, done)
    })

    it('works', function() {
      expect(
        this.req.i18n.t('please_confirm_email', {
          emailAddress: 'foo@example.com'
        })
      ).to.equal(
        'Please confirm your email foo@example.com by clicking on the link in the confirmation email '
      )
    })

    it('handles dashes after interpolation', function() {
      // This translation string has a problematic interpolation followed by a
      // dash: `__len__-day`
      expect(
        this.req.i18n.t('faq_how_does_free_trial_works_answer', {
          appName: 'Overleaf',
          len: '5'
        })
      ).to.equal(
        'You get full access to your chosen Overleaf plan during your 5-day free trial. There is no obligation to continue beyond the trial. Your card will be charged at the end of your 5 day trial unless you cancel before then. You can cancel via your subscription settings.'
      )
    })

    it('disables escaping', function() {
      expect(
        this.req.i18n.t('admin_user_created_message', {
          link: 'http://google.com'
        })
      ).to.equal(
        'Created admin user, <a href="http://google.com">Log in here</a> to continue'
      )
    })
  })

  describe('query string detection', function() {
    it('sets the language to french if the setLng query string is fr', function(done) {
      this.req.originalUrl = 'www.sharelatex.com/login?setLng=fr'
      this.req.url = 'www.sharelatex.com/login'
      this.req.query = { setLng: 'fr' }
      this.req.headers.host = 'www.sharelatex.com'
      this.translations.expressMiddleware(this.req, this.res, () => {
        this.translations.setLangBasedOnDomainMiddleware(
          this.req,
          this.res,
          () => {
            expect(this.req.lng).to.equal('fr')
            done()
          }
        )
      })
    })
  })

  describe('setLangBasedOnDomainMiddleware', function() {
    it('should set the lang to french if the domain is fr', function(done) {
      this.req.url = 'fr.sharelatex.com/login'
      this.req.headers.host = 'fr.sharelatex.com'
      this.translations.expressMiddleware(this.req, this.res, () => {
        this.translations.setLangBasedOnDomainMiddleware(
          this.req,
          this.res,
          () => {
            expect(this.req.lng).to.equal('fr')
            done()
          }
        )
      })
    })

    it('ignores domain if setLng query param is set', function(done) {
      this.req.originalUrl = 'fr.sharelatex.com/login?setLng=en'
      this.req.url = 'fr.sharelatex.com/login'
      this.req.query = { setLng: 'en' }
      this.req.headers.host = 'fr.sharelatex.com'
      this.translations.expressMiddleware(this.req, this.res, () => {
        this.translations.setLangBasedOnDomainMiddleware(
          this.req,
          this.res,
          () => {
            expect(this.req.lng).to.equal('en')
            done()
          }
        )
      })
    })

    describe('showUserOtherLng', function() {
      it('should set showUserOtherLng=true if the detected lang is different to subdomain lang', function(done) {
        this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        this.req.url = 'fr.sharelatex.com/login'
        this.req.headers.host = 'fr.sharelatex.com'
        this.translations.expressMiddleware(this.req, this.res, () => {
          this.translations.setLangBasedOnDomainMiddleware(
            this.req,
            this.res,
            () => {
              expect(this.req.showUserOtherLng).to.equal('da')
              done()
            }
          )
        })
      })

      it('should not set showUserOtherLng if the detected lang is the same as subdomain lang', function(done) {
        this.req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        this.req.url = 'da.sharelatex.com/login'
        this.req.headers.host = 'da.sharelatex.com'
        this.translations.expressMiddleware(this.req, this.res, () => {
          this.translations.setLangBasedOnDomainMiddleware(
            this.req,
            this.res,
            () => {
              expect(this.req.showUserOtherLng).to.not.exist
              done()
            }
          )
        })
      })
    })
  })
})
