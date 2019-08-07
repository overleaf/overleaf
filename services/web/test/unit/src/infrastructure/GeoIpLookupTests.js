/* eslint-disable
    handle-callback-err,
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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/infrastructure/GeoIpLookup'
)
const { expect } = require('chai')

describe('GeoIpLookup', function() {
  beforeEach(function() {
    this.settings = {
      apis: {
        geoIpLookup: {
          url: 'http://lookup.com'
        }
      }
    }
    this.request = { get: sinon.stub() }
    this.GeoIpLookup = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        request: this.request,
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log() {},
          err() {}
        }
      }
    })
    this.ipAddress = '123.456.789.123'

    return (this.stubbedResponse = {
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
      area_code: ''
    })
  })

  describe('getDetails', function() {
    beforeEach(function() {
      return this.request.get.callsArgWith(1, null, null, this.stubbedResponse)
    })

    it('should request the details using the ip', function(done) {
      return this.GeoIpLookup.getDetails(this.ipAddress, err => {
        this.request.get
          .calledWith({
            url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
            timeout: 1000,
            json: true
          })
          .should.equal(true)
        return done()
      })
    })

    it('should return the ip details', function(done) {
      return this.GeoIpLookup.getDetails(
        this.ipAddress,
        (err, returnedDetails) => {
          assert.deepEqual(returnedDetails, this.stubbedResponse)
          return done()
        }
      )
    })

    it('should take the first ip in the string', function(done) {
      return this.GeoIpLookup.getDetails(
        ` ${this.ipAddress} 456.312.452.102 432.433.888.234`,
        err => {
          this.request.get
            .calledWith({
              url: this.settings.apis.geoIpLookup.url + '/' + this.ipAddress,
              timeout: 1000,
              json: true
            })
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('getCurrencyCode', function() {
    it('should return GBP for GB country', function(done) {
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedResponse)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('GBP')
          return done()
        }
      )
    })

    it('should return GBP for gb country', function(done) {
      this.stubbedResponse.country_code = 'gb'
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedResponse)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('GBP')
          return done()
        }
      )
    })

    it('should return USD for US', function(done) {
      this.stubbedResponse.country_code = 'US'
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedResponse)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('USD')
          return done()
        }
      )
    })

    it('should return EUR for DE', function(done) {
      this.stubbedResponse.country_code = 'DE'
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedResponse)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('EUR')
          return done()
        }
      )
    })

    it('should default to USD if there is an error', function(done) {
      this.GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, 'problem')
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('USD')
          return done()
        }
      )
    })

    it('should default to USD if there are no details', function(done) {
      this.GeoIpLookup.getDetails = sinon.stub().callsArgWith(1)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('USD')
          return done()
        }
      )
    })

    it('should default to USD if there is no match for their country', function(done) {
      this.stubbedResponse.country_code = 'Non existant'
      this.GeoIpLookup.getDetails = sinon
        .stub()
        .callsArgWith(1, null, this.stubbedResponse)
      return this.GeoIpLookup.getCurrencyCode(
        this.ipAddress,
        (err, currencyCode) => {
          currencyCode.should.equal('USD')
          return done()
        }
      )
    })
  })
})
