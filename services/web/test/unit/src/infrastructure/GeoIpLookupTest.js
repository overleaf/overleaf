const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/infrastructure/GeoIpLookup'
)

describe('GeoIpLookup', function () {
  beforeEach(function () {
    this.ipAddress = '12.34.56.78'

    this.stubbedResponse = {
      ip: this.ipAddress,
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
    this.fetchUtils = {
      fetchJson: sinon.stub().resolves(this.stubbedResponse),
    }
    this.settings = {
      apis: {
        geoIpLookup: {
          url: 'http://lookup.com/',
        },
      },
    }
    this.GeoIpLookup = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/fetch-utils': this.fetchUtils,
        '@overleaf/settings': this.settings,
      },
    })
  })

  describe('isValidCurrencyParam', function () {
    it('should reject invalid currency codes', function () {
      expect(this.GeoIpLookup.isValidCurrencyParam('GBP')).to.equal(true)
      expect(this.GeoIpLookup.isValidCurrencyParam('USD')).to.equal(true)
      expect(this.GeoIpLookup.isValidCurrencyParam('AUD')).to.equal(true)
      expect(this.GeoIpLookup.isValidCurrencyParam('EUR')).to.equal(true)
      expect(this.GeoIpLookup.isValidCurrencyParam('SGD')).to.equal(true)
      expect(this.GeoIpLookup.isValidCurrencyParam('WAT')).to.equal(false)
      expect(this.GeoIpLookup.isValidCurrencyParam('NON')).to.equal(false)
      expect(this.GeoIpLookup.isValidCurrencyParam('LOL')).to.equal(false)
    })
  })

  describe('getDetails', function () {
    beforeEach(function () {
      this.fetchUtils.fetchJson.resolves(this.stubbedResponse)
    })

    describe('async', function () {
      it('should request the details using the ip', async function () {
        await this.GeoIpLookup.promises.getDetails(this.ipAddress)
        this.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(this.settings.apis.geoIpLookup.url + this.ipAddress)
        )
      })

      it('should return the ip details', async function () {
        const returnedDetails = await this.GeoIpLookup.promises.getDetails(
          this.ipAddress
        )
        assert.deepEqual(returnedDetails, this.stubbedResponse)
      })

      it('should take the first ip in the string', async function () {
        await this.GeoIpLookup.promises.getDetails(
          ` ${this.ipAddress} 123.123.123.123 234.234.234.234`
        )
        this.fetchUtils.fetchJson.should.have.been.calledWith(
          new URL(this.settings.apis.geoIpLookup.url + this.ipAddress)
        )
      })
    })
  })

  describe('getCurrencyCode', function () {
    describe('async', function () {
      it('should return GBP for GB country', async function () {
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return GBP for gb country', async function () {
        this.stubbedResponse.country_code = 'gb'
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return USD for US', async function () {
        this.stubbedResponse.country_code = 'US'
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('US')
      })

      it('should return EUR for DE', async function () {
        this.stubbedResponse.country_code = 'DE'
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('EUR')
        countryCode.should.equal('DE')
      })

      it('should default to USD if there is an error', async function () {
        this.fetchUtils.fetchJson.rejects(new Error('foo'))
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there are no details', async function () {
        this.fetchUtils.fetchJson.resolves({})
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there is no match for their country', async function () {
        this.stubbedResponse.country_code = 'Non existant'
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('NON EXISTANT')
      })
    })
  })
})
