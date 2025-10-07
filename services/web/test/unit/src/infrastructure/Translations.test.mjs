import { describe, expect, it, vi } from 'vitest'

const MODULE_PATH = '../../../../app/src/infrastructure/Translations.mjs'

describe('Translations', function () {
  let req, res, translations
  async function runMiddlewares(cb) {
    return await new Promise((resolve, reject) =>
      translations.i18nMiddleware(req, res, () => {
        translations.setLangBasedOnDomainMiddleware(req, res, (err, result) => {
          if (err) {
            reject(err)
          } else {
            resolve(result)
          }
        })
      })
    )
  }

  beforeEach(async function () {
    vi.doMock('@overleaf/settings', () => ({
      default: {
        i18n: {
          escapeHTMLInVars: false,
          subdomainLang: {
            www: { lngCode: 'en', url: 'https://www.overleaf.com' },
            fr: { lngCode: 'fr', url: 'https://fr.overleaf.com' },
            da: { lngCode: 'da', url: 'https://da.overleaf.com' },
          },
        },
      },
    }))

    translations = (await import(MODULE_PATH)).default

    req = {
      url: '/',
      headers: {
        'accept-language': '',
      },
    }
    res = {
      locals: {},
      getHeader: () => {},
      setHeader: () => {},
    }
  })

  describe('translate', function () {
    beforeEach(async function () {
      await runMiddlewares()
    })

    it('works', function () {
      expect(req.i18n.t('give_feedback')).to.equal('Give feedback')
    })

    it('has translate alias', function () {
      expect(req.i18n.translate('give_feedback')).to.equal('Give feedback')
    })
  })

  describe('interpolation', function () {
    beforeEach(async function () {
      await runMiddlewares()
    })

    it('works', function () {
      expect(
        req.i18n.t('please_confirm_email', {
          emailAddress: 'foo@example.com',
        })
      ).to.equal(
        'Please confirm your email foo@example.com by clicking on the link in the confirmation email '
      )
    })

    it('handles dashes after interpolation', function () {
      // This translation string has a problematic interpolation followed by a
      // dash: `__len__-day`
      expect(
        req.i18n.t('faq_how_does_free_trial_works_answer', {
          appName: 'Overleaf',
          len: '5',
        })
      ).to.equal(
        'You get full access to your chosen Overleaf plan during your 5-day free trial. There is no obligation to continue beyond the trial. Your card will be charged at the end of your 5 day trial unless you cancel before then. You can cancel via your subscription settings.'
      )
    })

    it('disables escaping', function () {
      expect(
        req.i18n.t('admin_user_created_message', {
          link: 'http://google.com',
        })
      ).to.equal(
        'Created admin user, <a href="http://google.com">Log in here</a> to continue'
      )
    })
  })

  describe('setLangBasedOnDomainMiddleware', function () {
    it('should set the lang to french if the domain is fr', async function () {
      req.headers.host = 'fr.overleaf.com'
      await runMiddlewares()
      expect(req.lng).to.equal('fr')
    })

    describe('suggestedLanguageSubdomainConfig', function () {
      it('should set suggestedLanguageSubdomainConfig if the detected lang is different to subdomain lang', async function () {
        req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        req.headers.host = 'fr.overleaf.com'
        await runMiddlewares()
        expect(res.locals.suggestedLanguageSubdomainConfig).to.exist
        expect(res.locals.suggestedLanguageSubdomainConfig.lngCode).to.equal(
          'da'
        )
      })

      it('should not set suggestedLanguageSubdomainConfig if the detected lang is the same as subdomain lang', async function () {
        req.headers['accept-language'] = 'da, en-gb;q=0.8, en;q=0.7'
        req.headers.host = 'da.overleaf.com'
        await runMiddlewares()
        expect(res.locals.suggestedLanguageSubdomainConfig).to.not.exist
      })
    })
  })
})
