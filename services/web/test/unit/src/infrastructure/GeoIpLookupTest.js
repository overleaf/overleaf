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
    this.request = { get: sinon.stub() }
    this.settings = {
      apis: {
        geoIpLookup: {
          url: 'http://lookup.com',
        },
      },
    }
    this.GeoIpLookup = SandboxedModule.require(modulePath, {
      requires: {
        request: this.request,
        '@overleaf/settings': this.settings,
      },
    })
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
      this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
    })

    describe('callback', function () {
      it('should request the details using the ip', function (done) {
        this.GeoIpLookup.getDetails(this.ipAddress, err => {
          assert.equal(err, null)
          this.request.get
            .calledWith({
              url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
              timeout: 1000,
              json: true,
            })
            .should.equal(true)
          done()
        })
      })

      it('should return the ip details', function (done) {
        this.GeoIpLookup.getDetails(this.ipAddress, (err, returnedDetails) => {
          assert.equal(err, null)
          assert.deepEqual(returnedDetails, this.stubbedResponse)
          done()
        })
      })

      it('should take the first ip in the string', function (done) {
        this.GeoIpLookup.getDetails(
          ` ${this.ipAddress} 123.123.123.123 234.234.234.234`,
          err => {
            assert.equal(err, null)
            this.request.get
              .calledWith({
                url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
                timeout: 1000,
                json: true,
              })
              .should.equal(true)
            done()
          }
        )
      })
    })

    describe('async', function () {
      it('should request the details using the ip', async function () {
        await this.GeoIpLookup.promises.getDetails(this.ipAddress)
        this.request.get
          .calledWith({
            url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
            timeout: 1000,
            json: true,
          })
          .should.equal(true)
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
        this.request.get
          .calledWith({
            url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
            timeout: 1000,
            json: true,
          })
          .should.equal(true)
      })
    })
  })

  describe('getCurrencyCode', function () {
    describe('callback', function () {
      it('should return GBP for GB country', function (done) {
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('GBP')
            done()
          }
        )
      })

      it('should return GBP for gb country', function (done) {
        this.stubbedResponse.country_code = 'gb'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('GBP')
            done()
          }
        )
      })

      it('should return USD for US', function (done) {
        this.stubbedResponse.country_code = 'US'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('USD')
            done()
          }
        )
      })

      it('should return EUR for DE', function (done) {
        this.stubbedResponse.country_code = 'DE'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('EUR')
            done()
          }
        )
      })

      it('should default to USD if there is an error', function (done) {
        this.request.get.callsArgWith(1, null, null, { error: true })
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('USD')
            done()
          }
        )
      })

      it('should default to USD if there are no details', function (done) {
        this.request.get.callsArgWith(1, null, null, {})
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('USD')
            done()
          }
        )
      })

      it('should default to USD if there is no match for their country', function (done) {
        this.stubbedResponse.country_code = 'Non existant'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        this.GeoIpLookup.getCurrencyCode(
          this.ipAddress,
          (err, currencyCode) => {
            assert.equal(err, null)
            currencyCode.should.equal('USD')
            done()
          }
        )
      })
    })

    describe('async', function () {
      it('should return GBP for GB country', async function () {
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return GBP for gb country', async function () {
        this.stubbedResponse.country_code = 'gb'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('GBP')
        countryCode.should.equal('GB')
      })

      it('should return USD for US', async function () {
        this.stubbedResponse.country_code = 'US'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('US')
      })

      it('should return EUR for DE', async function () {
        this.stubbedResponse.country_code = 'DE'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('EUR')
        countryCode.should.equal('DE')
      })

      it('should default to USD if there is an error', async function () {
        this.request.get.callsArgWith(1, null, null, { error: true })
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there are no details', async function () {
        this.request.get.callsArgWith(1, null, null, {})
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        expect(countryCode).to.be.undefined
      })

      it('should default to USD if there is no match for their country', async function () {
        this.stubbedResponse.country_code = 'Non existant'
        this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
        const { currencyCode, countryCode } =
          await this.GeoIpLookup.promises.getCurrencyCode(this.ipAddress)
        currencyCode.should.equal('USD')
        countryCode.should.equal('NON EXISTANT')
      })
    })
  })
})
