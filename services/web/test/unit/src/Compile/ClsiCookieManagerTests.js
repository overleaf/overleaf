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
const sinon = require('sinon')
const chai = require('chai')
const { assert } = chai
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Compile/ClsiCookieManager.js'
const SandboxedModule = require('sandboxed-module')
const realRequst = require('request')

describe('ClsiCookieManager', function() {
  beforeEach(function() {
    const self = this
    this.redisMulti = {
      set: sinon.stub(),
      get: sinon.stub(),
      expire: sinon.stub(),
      exec: sinon.stub()
    }
    this.redis = {
      auth() {},
      get: sinon.stub(),
      multi() {
        return self.redisMulti
      }
    }
    this.project_id = '123423431321'
    this.request = {
      get: sinon.stub(),
      cookie: realRequst.cookie,
      jar: realRequst.jar
    }
    this.settings = {
      redis: {
        web: 'redis.something'
      },
      apis: {
        clsi: {
          url: 'http://clsi.example.com'
        }
      },
      clsiCookie: {
        ttl: Math.random(),
        key: 'coooookie'
      }
    }
    this.requires = {
      '../../infrastructure/RedisWrapper': (this.RedisWrapper = {
        client: () => this.redis
      }),
      'settings-sharelatex': this.settings,
      request: this.request,

      'logger-sharelatex': (this.logger = {
        log: sinon.stub(),
        error: sinon.stub(),
        warn: sinon.stub()
      })
    }
    return (this.ClsiCookieManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: this.requires
    })())
  })

  describe('getServerId', function() {
    it('should call get for the key', function(done) {
      this.redis.get.callsArgWith(1, null, 'clsi-7')
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        (err, serverId) => {
          this.redis.get
            .calledWith(`clsiserver:${this.project_id}`)
            .should.equal(true)
          serverId.should.equal('clsi-7')
          return done()
        }
      )
    })

    it('should _populateServerIdViaRequest if no key is found', function(done) {
      this.ClsiCookieManager._populateServerIdViaRequest = sinon
        .stub()
        .callsArgWith(1)
      this.redis.get.callsArgWith(1, null)
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        (err, serverId) => {
          this.ClsiCookieManager._populateServerIdViaRequest
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should _populateServerIdViaRequest if no key is blank', function(done) {
      this.ClsiCookieManager._populateServerIdViaRequest = sinon
        .stub()
        .callsArgWith(1)
      this.redis.get.callsArgWith(1, null, '')
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        (err, serverId) => {
          this.ClsiCookieManager._populateServerIdViaRequest
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('_populateServerIdViaRequest', function() {
    beforeEach(function() {
      this.response = 'some data'
      this.request.get.callsArgWith(1, null, this.response)
      return (this.ClsiCookieManager.setServerId = sinon
        .stub()
        .callsArgWith(2, null, 'clsi-9'))
    })

    it('should make a request to the clsi', function(done) {
      return this.ClsiCookieManager._populateServerIdViaRequest(
        this.project_id,
        (err, serverId) => {
          const args = this.ClsiCookieManager.setServerId.args[0]
          args[0].should.equal(this.project_id)
          args[1].should.deep.equal(this.response)
          return done()
        }
      )
    })

    it('should return the server id', function(done) {
      return this.ClsiCookieManager._populateServerIdViaRequest(
        this.project_id,
        (err, serverId) => {
          serverId.should.equal('clsi-9')
          return done()
        }
      )
    })
  })

  describe('setServerId', function() {
    beforeEach(function() {
      this.response = 'dsadsakj'
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
      return this.redisMulti.exec.callsArgWith(0)
    })

    it('should set the server id with a ttl', function(done) {
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.response,
        err => {
          this.redisMulti.set
            .calledWith(`clsiserver:${this.project_id}`, 'clsi-8')
            .should.equal(true)
          this.redisMulti.expire
            .calledWith(
              `clsiserver:${this.project_id}`,
              this.settings.clsiCookie.ttl
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should return the server id', function(done) {
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.response,
        (err, serverId) => {
          serverId.should.equal('clsi-8')
          return done()
        }
      )
    })

    it('should not set the server id if clsiCookies are not enabled', function(done) {
      delete this.settings.clsiCookie.key
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      })()
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.response,
        (err, serverId) => {
          this.redisMulti.exec.called.should.equal(false)
          return done()
        }
      )
    })

    it('should not set the server id there is no server id in the response', function(done) {
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns(null)
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.response,
        (err, serverId) => {
          this.redisMulti.exec.called.should.equal(false)
          return done()
        }
      )
    })

    it('should also set in the secondary if secondary redis is enabled', function(done) {
      this.redisSecondaryMulti = {
        set: sinon.stub(),
        expire: sinon.stub(),
        exec: sinon.stub()
      }
      this.redis_secondary = { multi: () => this.redisSecondaryMulti }
      this.settings.redis.clsi_cookie_secondary = {}
      this.RedisWrapper.client = sinon.stub()
      this.RedisWrapper.client.withArgs('clsi_cookie').returns(this.redis)
      this.RedisWrapper.client
        .withArgs('clsi_cookie_secondary')
        .returns(this.redis_secondary)
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      })()
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.response,
        (err, serverId) => {
          this.redisSecondaryMulti.set
            .calledWith(`clsiserver:${this.project_id}`, 'clsi-8')
            .should.equal(true)
          this.redisSecondaryMulti.expire
            .calledWith(
              `clsiserver:${this.project_id}`,
              this.settings.clsiCookie.ttl
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('getCookieJar', function() {
    beforeEach(function() {
      return (this.ClsiCookieManager._getServerId = sinon
        .stub()
        .callsArgWith(1, null, 'clsi-11'))
    })

    it('should return a jar with the cookie set populated from redis', function(done) {
      return this.ClsiCookieManager.getCookieJar(
        this.project_id,
        (err, jar) => {
          jar._jar.store.idx['clsi.example.com']['/'][
            this.settings.clsiCookie.key
          ].key.should.equal
          jar._jar.store.idx['clsi.example.com']['/'][
            this.settings.clsiCookie.key
          ].value.should.equal('clsi-11')
          return done()
        }
      )
    })

    it('should return empty cookie jar if clsiCookies are not enabled', function(done) {
      delete this.settings.clsiCookie.key
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console: console
        },
        requires: this.requires
      })()
      return this.ClsiCookieManager.getCookieJar(
        this.project_id,
        (err, jar) => {
          assert.deepEqual(jar, realRequst.jar())
          return done()
        }
      )
    })
  })
})
