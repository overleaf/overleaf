/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('node:assert')
const path = require('node:path')
const sinon = require('sinon')
const modulePath = path.join(__dirname, './../../../index.js')
const redisLockerModulePath = path.join(__dirname, './../../../RedisLocker.js')
const { expect } = require('chai')

describe('index', function () {
  beforeEach(function () {
    let Cluster, IoRedis, ioredisConstructor
    this.settings = {}
    this.ioredisConstructor = ioredisConstructor = sinon.stub()

    this.ioredis = IoRedis = (function () {
      let createIoRedis
      IoRedis = class IoRedis {
        static initClass() {
          this.prototype.on = sinon.stub()
          createIoRedis = ioredisConstructor
        }

        constructor() {
          return createIoRedis.apply(this, arguments)
        }
      }
      IoRedis.initClass()
      return IoRedis
    })()
    this.ioredis.Cluster = Cluster = (function () {
      Cluster = class Cluster {
        static initClass() {
          this.prototype.on = sinon.stub()
        }

        constructor(config, options) {
          this.config = config
          this.options = options
        }
      }
      Cluster.initClass()
      return Cluster
    })()
    this.redis = SandboxedModule.require(modulePath, {
      requires: {
        ioredis: this.ioredis,
      },
      globals: {
        process,
        Buffer,
      },
    })
    this.auth_pass = '1234 pass'

    this.RedisLocker = SandboxedModule.require(redisLockerModulePath, {
      requires: {
        '@overleaf/metrics': {
          inc() {},
        },
      },
      globals: {
        process,
        Math,
        Buffer,
      },
    })
  })

  describe('lock TTL', function () {
    it('should throw an error when creating a client with wrong type', function () {
      const createNewRedisLock = () => {
        return new this.RedisLocker({
          lockTTLSeconds: '60',
        })
      }
      expect(createNewRedisLock).to.throw(
        'redis lock TTL must be at least 30s and below 1000s'
      )
    })

    it('should throw an error when creating a client with small TTL', function () {
      const createNewRedisLock = () => {
        return new this.RedisLocker({
          lockTTLSeconds: 1,
        })
      }
      expect(createNewRedisLock).to.throw(
        'redis lock TTL must be at least 30s and below 1000s'
      )
    })

    it('should throw an error when creating a client with huge TTL', function () {
      const createNewRedisLock = () => {
        return new this.RedisLocker({
          lockTTLSeconds: 30_000,
        })
      }
      expect(createNewRedisLock).to.throw(
        'redis lock TTL must be at least 30s and below 1000s'
      )
    })
  })

  describe('redis-sentinel', function () {
    it('should throw an error when creating a client', function () {
      const redisSentinelOptions = {
        endpoints: ['127.0.0.1:1234', '127.0.0.1:2345', '127.0.0.1:3456'],
      }
      const createNewClient = () => {
        this.redis.createClient(redisSentinelOptions)
      }
      expect(createNewClient).to.throw(
        '@overleaf/redis-wrapper: redis-sentinel is no longer supported'
      )
    })
  })

  describe('single node redis', function () {
    beforeEach(function () {
      return (this.standardOpts = {
        auth_pass: this.auth_pass,
        port: 1234,
        host: 'redis.mysite.env',
      })
    })

    it('should work without opts', function () {
      this.redis.createClient()
    })

    it('should use the ioredis driver in single-instance mode if a non array is passed', function () {
      const client = this.redis.createClient(this.standardOpts)
      return assert.equal(client.constructor, this.ioredis)
    })

    return it('should call createClient for the ioredis driver in single-instance mode if a non array is passed', function () {
      this.redis.createClient(this.standardOpts)
      return this.ioredisConstructor
        .calledWith(sinon.match(this.standardOpts))
        .should.equal(true)
    })
  })

  describe('cluster', function () {
    beforeEach(function () {
      this.cluster = [{ mock: 'cluster' }, { mock: 'cluster2' }]
      this.extraOptions = { keepAlive: 100 }
      return (this.settings = {
        cluster: this.cluster,
        redisOptions: this.extraOptions,
        key_schema: {
          foo(x) {
            return `${x}`
          },
        },
      })
    })

    it('should pass the options correctly though with no options', function () {
      const client = this.redis.createClient({ cluster: this.cluster })
      assert(client instanceof this.ioredis.Cluster)
      return client.config.should.deep.equal(this.cluster)
    })

    it('should not pass the key_schema through to the driver', function () {
      const client = this.redis.createClient({
        cluster: this.cluster,
        key_schema: 'foobar',
      })
      assert(client instanceof this.ioredis.Cluster)
      client.config.should.deep.equal(this.cluster)
      return expect(client.options).to.deep.equal({ retry_max_delay: 5000 })
    })

    return it('should pass the options correctly though with additional options', function () {
      const client = this.redis.createClient(this.settings)
      assert(client instanceof this.ioredis.Cluster)
      client.config.should.deep.equal(this.cluster)
      // need to use expect here because of _.clone in sandbox
      return expect(client.options).to.deep.equal({
        redisOptions: this.extraOptions,
        retry_max_delay: 5000,
      })
    })
  })

  return describe('monkey patch ioredis exec', function () {
    beforeEach(function () {
      this.callback = sinon.stub()
      this.results = []
      this.multiOrig = { exec: sinon.stub().yields(null, this.results) }
      this.client = { multi: sinon.stub().returns(this.multiOrig) }
      this.ioredisConstructor.returns(this.client)
      this.redis.createClient(this.client)
      return (this.multi = this.client.multi())
    })

    it('should return the old redis format for an array', function () {
      this.results[0] = [null, 42]
      this.results[1] = [null, 'foo']
      this.multi.exec(this.callback)
      return this.callback.calledWith(null, [42, 'foo']).should.equal(true)
    })

    return it('should return the old redis format when there is an error', function () {
      this.results[0] = [null, 42]
      this.results[1] = ['error', 'foo']
      this.multi.exec(this.callback)
      return this.callback.calledWith('error').should.equal(true)
    })
  })
})
