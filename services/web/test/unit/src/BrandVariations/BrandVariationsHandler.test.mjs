import { vi, expect } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/BrandVariations/BrandVariationsHandler.mjs'

describe('BrandVariationsHandler', function () {
  beforeEach(async function (ctx) {
    ctx.settings = {
      apis: {
        v1: {
          publicUrl: 'http://overleaf.example.com',
        },
      },
      modules: {
        sanitize: {
          options: {
            allowedTags: ['br', 'strong'],
            allowedAttributes: {
              strong: ['style'],
            },
          },
        },
      },
    }
    ctx.V1Api = { request: sinon.stub() }

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    vi.doMock('../../../../app/src/Features/V1/V1Api', () => ({
      default: ctx.V1Api,
    }))

    ctx.BrandVariationsHandler = (await import(modulePath)).default
    ctx.mockedBrandVariationDetails = {
      id: '12',
      active: true,
      brand_name: 'The journal',
      logo_url: 'http://my.cdn.tld/journal-logo.png',
      journal_cover_url: 'http://my.cdn.tld/journal-cover.jpg',
      home_url: 'http://www.thejournal.com/',
      publish_menu_link_html: 'Submit your paper to the <em>The Journal</em>',
    }
  })

  describe('getBrandVariationById', function () {
    it('should reject with an error when the branding variation id is not provided', async function (ctx) {
      await expect(
        ctx.BrandVariationsHandler.promises.getBrandVariationById(null)
      ).to.be.rejected
    })

    it('should reject with an error when the request errors', async function (ctx) {
      ctx.V1Api.request.callsArgWith(1, new Error())
      await expect(
        ctx.BrandVariationsHandler.promises.getBrandVariationById('12')
      ).to.be.rejected
    })

    it('should return branding details when request succeeds', async function (ctx) {
      ctx.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        ctx.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await ctx.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails).to.deep.equal(
        ctx.mockedBrandVariationDetails
      )
    })

    it('should transform relative URLs in v1 absolute ones', async function (ctx) {
      ctx.mockedBrandVariationDetails.logo_url = '/journal-logo.png'
      ctx.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        ctx.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await ctx.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(
        brandVariationDetails.logo_url.startsWith(
          ctx.settings.apis.v1.publicUrl
        )
      ).to.be.true
    })

    it("should sanitize 'submit_button_html'", async function (ctx) {
      ctx.mockedBrandVariationDetails.submit_button_html =
        '<br class="break"/><strong style="color:#B39500">AGU Journal</strong><iframe>hello</iframe>'
      ctx.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        ctx.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await ctx.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails.submit_button_html).to.equal(
        '<br /><strong style="color:#B39500">AGU Journal</strong>hello'
      )
    })

    it("should sanitize and remove breaks in 'submit_button_html_no_br'", async function (ctx) {
      ctx.mockedBrandVariationDetails.submit_button_html =
        'Submit to<br class="break"/><strong style="color:#B39500">AGU Journal</strong><iframe>hello</iframe>'
      ctx.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        ctx.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await ctx.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails.submit_button_html_no_br).to.equal(
        'Submit to <strong style="color:#B39500">AGU Journal</strong>hello'
      )
    })
  })
})
