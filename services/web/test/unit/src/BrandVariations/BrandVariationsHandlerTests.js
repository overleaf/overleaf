/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/BrandVariations/BrandVariationsHandler'
)

describe('BrandVariationsHandler', function () {
  beforeEach(function () {
    this.settings = {
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
    this.V1Api = { request: sinon.stub() }
    this.BrandVariationsHandler = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': this.settings,
        '../V1/V1Api': this.V1Api,
      },
    })
    return (this.mockedBrandVariationDetails = {
      id: '12',
      active: true,
      brand_name: 'The journal',
      logo_url: 'http://my.cdn.tld/journal-logo.png',
      journal_cover_url: 'http://my.cdn.tld/journal-cover.jpg',
      home_url: 'http://www.thejournal.com/',
      publish_menu_link_html: 'Submit your paper to the <em>The Journal</em>',
    })
  })

  describe('getBrandVariationById', function () {
    it('should reject with an error when the branding variation id is not provided', async function () {
      await expect(
        this.BrandVariationsHandler.promises.getBrandVariationById(null)
      ).to.be.rejected
    })

    it('should reject with an error when the request errors', async function () {
      this.V1Api.request.callsArgWith(1, new Error())
      await expect(
        this.BrandVariationsHandler.promises.getBrandVariationById('12')
      ).to.be.rejected
    })

    it('should return branding details when request succeeds', async function () {
      this.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await this.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails).to.deep.equal(
        this.mockedBrandVariationDetails
      )
    })

    it('should transform relative URLs in v1 absolute ones', async function () {
      this.mockedBrandVariationDetails.logo_url = '/journal-logo.png'
      this.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await this.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(
        brandVariationDetails.logo_url.startsWith(
          this.settings.apis.v1.publicUrl
        )
      ).to.be.true
    })

    it("should sanitize 'submit_button_html'", async function () {
      this.mockedBrandVariationDetails.submit_button_html =
        '<br class="break"/><strong style="color:#B39500">AGU Journal</strong><iframe>hello</iframe>'
      this.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await this.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails.submit_button_html).to.equal(
        '<br /><strong style="color:#B39500">AGU Journal</strong>hello'
      )
    })

    it("should sanitize and remove breaks in 'submit_button_html_no_br'", async function () {
      this.mockedBrandVariationDetails.submit_button_html =
        'Submit to<br class="break"/><strong style="color:#B39500">AGU Journal</strong><iframe>hello</iframe>'
      this.V1Api.request.callsArgWith(
        1,
        null,
        { statusCode: 200 },
        this.mockedBrandVariationDetails
      )
      const brandVariationDetails =
        await this.BrandVariationsHandler.promises.getBrandVariationById('12')
      expect(brandVariationDetails.submit_button_html_no_br).to.equal(
        'Submit to <strong style="color:#B39500">AGU Journal</strong>hello'
      )
    })
  })
})
