import { assert, describe, beforeEach, it, vi, expect } from 'vitest'
import path from 'node:path'
import sinon from 'sinon'

const modulePath = path.join(
  import.meta.dirname,
  '../../../../app/src/infrastructure/GeoIpLookup'
)

describe('GeoIpLookup', function () {
  beforeEach(async function (ctx) {
    ctx.ipAddress = '12.34.56.78'

    ctx.stubbedResponse = {
      ip: ctx.ipAddress,
      country_code: 'GB',
      country_name: 'United Kingdom',
      region_code: 'H9',
      region_name: 'London, City of',
      city: 'London',
      zipcode: 'SE16',
      latitude: 51.0,
      longitude: -0.0493,
      metro_code: '',
      area_code: '',
    }
    ctx.fetchUtils = {
      fetchJson: sinon.stub().resolves(ctx.stubbedResponse),
    }
    ctx.settings = {
      apis: {
        geoIpLookup: {
          url: 'http://lookup.com/',
        },
      },
    }

    vi.doMock('@overleaf/fetch-utils', () => ({
      ...ctx.fetchUtils,
    }))

    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))

    ctx.GeoIpLookup = (await import(modulePath)).default
  })

  describe('isValidCurrencyParam', function () {
    it('should reject invalid currency codes', function (ctx) {
      expect(ctx.GeoIpLookup.isValidCurrencyParam('GBP')).to.equal(true)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('USD')).to.equal(true)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('AUD')).to.equal(true)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('EUR')).to.equal(true)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('SGD')).to.equal(true)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('WAT')).to.equal(false)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('NON')).to.equal(false)
      expect(ctx.GeoIpLookup.isValidCurrencyParam('LOL')).to.equal(false)
    })
  })

  describe('getDetails', function () {
    beforeEach(function (ctx) {
      ctx.fetchUtils.fetchJson.resolves(ctx.stubbedResponse)
    })

    describe('async', function () {
      it('should request the details using the ip', async function (ctx) {
        await ctx.GeoIpLookup.promises.getDetails(ctx.ipAddress)
        ctx.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(ctx.settings.apis.geoIpLookup.url + ctx.ipAddress)
        )
      })

      it('should return the ip details', async function (ctx) {
        const returnedDetails = await ctx.GeoIpLookup.promises.getDetails(
          ctx.ipAddress
        )
        assert.deepEqual(returnedDetails, ctx.stubbedResponse)
      })

      it('should take the first ip in the string', async function (ctx) {
        await ctx.GeoIpLookup.promises.getDetails(
          ` ${ctx.ipAddress} 123.123.123.123 234.234.234.234`
        )
        ctx.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(ctx.settings.apis.geoIpLookup.url + ctx.ipAddress)
        )
      })
    })
  })

  describe('getCurrencyCode', function () {
    describe('async', function () {
      it('should return GBP for GB country', async function (ctx) {
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return GBP for gb country', async function (ctx) {
        ctx.stubbedResponse.country_code = 'gb'
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return USD for US', async function (ctx) {
        ctx.stubbedResponse.country_code = 'US'
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('US')
      })

      it('should return EUR for DE', async function (ctx) {
        ctx.stubbedResponse.country_code = 'DE'
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('EUR')
        countryCode.should.equal('DE')
      })

      it('should default to USD if there is an error', async function (ctx) {
        ctx.fetchUtils.fetchJson.rejects(new Error('foo'))
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there are no details', async function (ctx) {
        ctx.fetchUtils.fetchJson.resolves({})
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there is no match for their country', async function (ctx) {
        ctx.stubbedResponse.country_code = 'Non existant'
        const { currencyCode, countryCode } =
          await ctx.GeoIpLookup.promises.getCurrencyCode(ctx.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('NON EXISTANT')
      })
    })
  })
})
