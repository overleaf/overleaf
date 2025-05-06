const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../../app/src/Features/Compile/ClsiCookieManager.js'
const SandboxedModule = require('sandboxed-module')

describe('ClsiCookieManager', function () {
  beforeEach(function () {
    this.redis = {
      auth() {},
      get: sinon.stub(),
      setex: sinon.stub().resolves(),
    }
    this.project_id = '123423431321-proj-id'
    this.user_id = 'abc-user-id'
    this.fetchUtils = {
      fetchNothing: sinon.stub().returns(Promise.resolve()),
      fetchStringWithResponse: sinon.stub().returns(Promise.resolve()),
    }
    this.metrics = { inc: sinon.stub() }
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
      '@overleaf/fetch-utils': this.fetchUtils,
      '@overleaf/metrics': this.metrics,
    }
    this.ClsiCookieManager = SandboxedModule.require(modulePath, {
      requires: this.requires,
    })()
  })

  describe('getServerId', function () {
    it('should call get for the key', async function () {
      this.redis.get.resolves('clsi-7')
      const serverId = await this.ClsiCookieManager.promises.getServerId(
        this.project_id,
        this.user_id,
        '',
        'e2'
      )
      this.redis.get
        .calledWith(`clsiserver:${this.project_id}:${this.user_id}`)
        .should.equal(true)
      serverId.should.equal('clsi-7')
    })

    it('should _populateServerIdViaRequest if no key is found', async function () {
      this.ClsiCookieManager.promises._populateServerIdViaRequest = sinon
        .stub()
        .resolves()
      this.redis.get.resolves(null)
      await this.ClsiCookieManager.promises.getServerId(
        this.project_id,
        this.user_id,
        ''
      )
      this.ClsiCookieManager.promises._populateServerIdViaRequest
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    it('should _populateServerIdViaRequest if no key is blank', async function () {
      this.ClsiCookieManager.promises._populateServerIdViaRequest = sinon
        .stub()
        .resolves(null)
      this.redis.get.resolves('')
      await this.ClsiCookieManager.promises.getServerId(
        this.project_id,
        this.user_id,
        '',
        'e2'
      )
      this.ClsiCookieManager.promises._populateServerIdViaRequest
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })
  })

  describe('_populateServerIdViaRequest', function () {
    beforeEach(function () {
      this.clsiServerId = 'server-id'
      this.ClsiCookieManager.promises.setServerId = sinon.stub().resolves()
    })

    describe('with a server id in the response', function () {
      beforeEach(function () {
        this.response = {
          headers: {
            'set-cookie': [
              `${this.settings.clsiCookie.key}=${this.clsiServerId}`,
            ],
          },
        }
        this.fetchUtils.fetchNothing.returns(this.response)
      })

      it('should make a request to the clsi', async function () {
        await this.ClsiCookieManager.promises._populateServerIdViaRequest(
          this.project_id,
          this.user_id,
          'standard',
          'e2'
        )
        const args = this.ClsiCookieManager.promises.setServerId.args[0]
        args[0].should.equal(this.project_id)
        args[1].should.equal(this.user_id)
        args[2].should.equal('standard')
        args[3].should.equal('e2')
        args[4].should.deep.equal(this.clsiServerId)
      })

      it('should return the server id', async function () {
        const serverId =
          await this.ClsiCookieManager.promises._populateServerIdViaRequest(
            this.project_id,
            this.user_id,
            '',
            'e2'
          )
        serverId.should.equal(this.clsiServerId)
      })
    })

    describe('without a server id in the response', function () {
      beforeEach(function () {
        this.response = { headers: {} }
        this.fetchUtils.fetchNothing.returns(this.response)
      })
      it('should not set the server id there is no server id in the response', async function () {
        this.ClsiCookieManager._parseServerIdFromResponse = sinon
          .stub()
          .returns(null)
        await this.ClsiCookieManager.promises.setServerId(
          this.project_id,
          this.user_id,
          'standard',
          'e2',
          this.clsiServerId,
          null
        )
        this.redis.setex.called.should.equal(false)
      })
    })
  })

  describe('setServerId', function () {
    beforeEach(function () {
      this.clsiServerId = 'server-id'
      this.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
    })

    it('should set the server id with a ttl', async function () {
      await this.ClsiCookieManager.promises.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.clsiServerId,
        null
      )
      this.redis.setex.should.have.been.calledWith(
        `clsiserver:${this.project_id}:${this.user_id}`,
        this.settings.clsiCookie.ttlInSeconds,
        this.clsiServerId
      )
    })

    it('should set the server id with the regular ttl for reg instance', async function () {
      this.clsiServerId = 'clsi-reg-8'
      await this.ClsiCookieManager.promises.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.clsiServerId,
        null
      )
      expect(this.redis.setex).to.have.been.calledWith(
        `clsiserver:${this.project_id}:${this.user_id}`,
        this.settings.clsiCookie.ttlInSecondsRegular,
        this.clsiServerId
      )
    })

    it('should not set the server id if clsiCookies are not enabled', async function () {
      delete this.settings.clsiCookie.key
      this.ClsiCookieManager2 = SandboxedModule.require(modulePath, {
        globals: {
          console,
        },
        requires: this.requires,
      })()
      await this.ClsiCookieManager2.promises.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.clsiServerId,
        null
      )
      this.redis.setex.called.should.equal(false)
    })

    it('should also set in the secondary if secondary redis is enabled', async function () {
      this.redis_secondary = { setex: sinon.stub().resolves() }
      this.settings.redis.clsi_cookie_secondary = {}
      this.RedisWrapper.client = sinon.stub()
      this.RedisWrapper.client.withArgs('clsi_cookie').returns(this.redis)
      this.RedisWrapper.client
        .withArgs('clsi_cookie_secondary')
        .returns(this.redis_secondary)
      this.ClsiCookieManager2 = SandboxedModule.require(modulePath, {
        globals: {
          console,
        },
        requires: this.requires,
      })()
      this.ClsiCookieManager2._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
      await this.ClsiCookieManager2.promises.setServerId(
        this.project_id,
        this.user_id,
        'standard',
        'e2',
        this.clsiServerId,
        null
      )
      this.redis_secondary.setex.should.have.been.calledWith(
        `clsiserver:${this.project_id}:${this.user_id}`,
        this.settings.clsiCookie.ttlInSeconds,
        this.clsiServerId
      )
    })

    describe('checkIsLoadSheddingEvent', function () {
      beforeEach(function () {
        this.fetchUtils.fetchStringWithResponse.reset()
        this.call = async () => {
          await this.ClsiCookieManager.promises.setServerId(
            this.project_id,
            this.user_id,
            'standard',
            'e2',
            this.clsiServerId,
            'previous-clsi-server-id'
          )
          expect(
            this.fetchUtils.fetchStringWithResponse
          ).to.have.been.calledWith(
            `${this.settings.apis.clsi.url}/instance-state?clsiserverid=previous-clsi-server-id&compileGroup=standard&compileBackendClass=e2`,
            { method: 'GET', signal: sinon.match.instanceOf(AbortSignal) }
          )
        }
      })

      it('should report "load-shedding" when previous is UP', async function () {
        this.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 200 },
          body: 'previous-clsi-server-id,UP\n',
        })
        await this.call()
        expect(this.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'load-shedding' }
        )
      })

      it('should report "cycle" when other is UP', async function () {
        this.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 200 },
          body: 'other-clsi-server-id,UP\n',
        })
        await this.call()
        expect(this.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'cycle' }
        )
      })

      it('should report "cycle" when previous is 404', async function () {
        this.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 404 },
        })
        await this.call()
        expect(this.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'cycle' }
        )
      })
    })
  })
})
