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
const sinon = require('sinon')
const { assert, expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiCookieManager.js'
const SandboxedModule = require('sandboxed-module')
const realRequst = require('request')

describe('ClsiCookieManager', function () {
  beforeEach(function () {
    const self = this
    this.redis = {
      auth() {},
      get: sinon.stub(),
      setex: sinon.stub().callsArg(3),
    }
    this.project_id = '123423431321-proj-id'
    this.user_id = 'abc-user-id'
    this.request = {
      post: sinon.stub(),
      cookie: realRequst.cookie,
      jar: realRequst.jar,
      defaults: () => {
        return this.request
      },
    }
    this.settings = {
      redis: {
        web: 'redis.something',
      },
      apis: {
        clsi: {
          url: 'http://clsi.example.com',
        },
      },
      clsiCookie: {
        ttlInSeconds: Math.random().toString(),
        ttlInSecondsRegular: Math.random().toString(),
        key: 'coooookie',
      },
    }
    this.requires = {
      '../../infrastructure/RedisWrapper': (this.RedisWrapper = {
        client: () => this.redis,
      }),
      '@overleaf/settings': this.settings,
      request: this.request,
    }
    return (this.ClsiCookieManager = SandboxedModule.require(modulePath, {
      requires: this.requires,
    })())
  })

  describe('getServerId', function () {
    it('should call get for the key', function (done) {
      this.redis.get.callsArgWith(1, null, 'clsi-7')
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        this.user_id,
        '',
        'e2',
        (err, serverId) => {
          this.redis.get
            .calledWith(`clsiserver:${this.project_id}:${this.user_id}`)
            .should.equal(true)
          serverId.should.equal('clsi-7')
          return done()
        }
      )
    })

    it('should _populateServerIdViaRequest if no key is found', function (done) {
      this.ClsiCookieManager._populateServerIdViaRequest = sinon
        .stub()
        .yields(null)
      this.redis.get.callsArgWith(1, null)
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        this.user_id,
        '',
        (err, serverId) => {
          this.ClsiCookieManager._populateServerIdViaRequest
            .calledWith(this.project_id, this.user_id)
            .should.equal(true)
          return done()
        }
      )
    })

    it('should _populateServerIdViaRequest if no key is blank', function (done) {
      this.ClsiCookieManager._populateServerIdViaRequest = sinon
        .stub()
        .yields(null)
      this.redis.get.callsArgWith(1, null, '')
      return this.ClsiCookieManager._getServerId(
        this.project_id,
        this.user_id,
        '',
        'e2',
        (err, serverId) => {
          this.ClsiCookieManager._populateServerIdViaRequest
            .calledWith(this.project_id, this.user_id)
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('_populateServerIdViaRequest', function () {
    beforeEach(function () {
      this.response = 'some data'
      this.request.post.callsArgWith(1, null, this.response)
      return (this.ClsiCookieManager.setServerId = sinon
        .stub()
        .yields(null, 'clsi-9'))
    })

    it('should make a request to the clsi', function (done) {
      return this.ClsiCookieManager._populateServerIdViaRequest(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        (err, serverId) => {
          const args = this.ClsiCookieManager.setServerId.args[0]
          args[0].should.equal(this.project_id)
          args[1].should.equal(this.user_id)
          args[2].should.equal('standard')
          args[3].should.equal('e2')
          args[4].should.deep.equal(this.response)
          return done()
        }
      )
    })

    it('should return the server id', function (done) {
      return this.ClsiCookieManager._populateServerIdViaRequest(
        this.project_id,
        this.user_id,
        '',
        'e2',
        (err, serverId) => {
          serverId.should.equal('clsi-9')
          return done()
        }
      )
    })
  })

  describe('setServerId', function () {
    beforeEach(function () {
      this.response = 'dsadsakj'
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
    })

    it('should set the server id with a ttl', function (done) {
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        err => {
          this.redis.setex
            .calledWith(
              `clsiserver:${this.project_id}:${this.user_id}`,
              this.settings.clsiCookie.ttlInSeconds,
              'clsi-8'
            )
            .should.equal(true)
          return done()
        }
      )
    })

    it('should set the server id with the regular ttl for reg instance', function (done) {
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-reg-8')
      this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        err => {
          expect(this.redis.setex).to.have.been.calledWith(
            `clsiserver:${this.project_id}:${this.user_id}`,
            this.settings.clsiCookie.ttlInSecondsRegular,
            'clsi-reg-8'
          )
          done()
        }
      )
    })

    it('should return the server id', function (done) {
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        (err, serverId) => {
          serverId.should.equal('clsi-8')
          return done()
        }
      )
    })

    it('should not set the server id if clsiCookies are not enabled', function (done) {
      delete this.settings.clsiCookie.key
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console,
        },
        requires: this.requires,
      })()
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        (err, serverId) => {
          this.redis.setex.called.should.equal(false)
          return done()
        }
      )
    })

    it('should not set the server id there is no server id in the response', function (done) {
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns(null)
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        (err, serverId) => {
          this.redis.setex.called.should.equal(false)
          return done()
        }
      )
    })

    it('should also set in the secondary if secondary redis is enabled', function (done) {
      this.redis_secondary = { setex: sinon.stub().callsArg(3) }
      this.settings.redis.clsi_cookie_secondary = {}
      this.RedisWrapper.client = sinon.stub()
      this.RedisWrapper.client.withArgs('clsi_cookie').returns(this.redis)
      this.RedisWrapper.client
        .withArgs('clsi_cookie_secondary')
        .returns(this.redis_secondary)
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console,
        },
        requires: this.requires,
      })()
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
      return this.ClsiCookieManager.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.response,
        null,
        (err, serverId) => {
          this.redis_secondary.setex
            .calledWith(
              `clsiserver:${this.project_id}:${this.user_id}`,
              this.settings.clsiCookie.ttlInSeconds,
              'clsi-8'
            )
            .should.equal(true)
          return done()
        }
      )
    })
  })

  describe('getCookieJar', function () {
    beforeEach(function () {
      return (this.ClsiCookieManager._getServerId = sinon
        .stub()
        .yields(null, 'clsi-11'))
    })

    it('should return a jar with the cookie set populated from redis', function (done) {
      return this.ClsiCookieManager.getCookieJar(
        this.project_id,
        this.user_id,
        '',
        'e2',
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

    it('should return empty cookie jar if clsiCookies are not enabled', function (done) {
      delete this.settings.clsiCookie.key
      this.ClsiCookieManager = SandboxedModule.require(modulePath, {
        globals: {
          console,
        },
        requires: this.requires,
      })()
      return this.ClsiCookieManager.getCookieJar(
        this.project_id,
        this.user_id,
        '',
        'e2',
        (err, jar) => {
          assert.deepEqual(jar, realRequst.jar())
          return done()
        }
      )
    })
  })
})
