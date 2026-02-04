import sinon from 'sinon'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const modulePath = '../../../../app/src/Features/Compile/ClsiCookieManager.mjs'

describe('ClsiCookieManager', function () {
  beforeEach(async function (ctx) {
    ctx.redis = {
      auth() {},
      del: sinon.stub(),
      get: sinon.stub(),
      setex: sinon.stub().resolves(),
    }
    ctx.project_id = '123423431321-proj-id'
    ctx.user_id = 'abc-user-id'
    ctx.fetchUtils = {
      fetchNothing: sinon.stub().returns(Promise.resolve()),
      fetchStringWithResponse: sinon.stub().returns(Promise.resolve()),
    }
    ctx.metrics = { inc: sinon.stub() }
    ctx.settings = {
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
    vi.doMock('../../../../app/src/infrastructure/RedisWrapper', () => ({
      default: (ctx.RedisWrapper = {
        client: () => ctx.redis,
      }),
    }))
    vi.doMock('@overleaf/settings', () => ({
      default: ctx.settings,
    }))
    vi.doMock('@overleaf/fetch-utils', () => ctx.fetchUtils)
    vi.doMock('@overleaf/metrics', () => ({
      default: ctx.metrics,
    }))

    ctx.ClsiCookieManager = (await import(modulePath)).default()
  })

  describe('getServerId', function () {
    it('should call get for the key', async function (ctx) {
      ctx.redis.get.resolves('clsi-7')
      const serverId = await ctx.ClsiCookieManager.promises.getServerId(
        ctx.project_id,
        ctx.user_id,
        '',
        'c3d'
      )
      ctx.redis.get
        .calledWith(`clsiserver:c3d:${ctx.project_id}:${ctx.user_id}`)
        .should.equal(true)
      serverId.should.equal('clsi-7')
    })

    it('should _populateServerIdViaRequest if no key is found', async function (ctx) {
      ctx.ClsiCookieManager.promises._populateServerIdViaRequest = sinon
        .stub()
        .resolves()
      ctx.redis.get.resolves(null)
      await ctx.ClsiCookieManager.promises.getServerId(
        ctx.project_id,
        ctx.user_id,
        ''
      )
      ctx.ClsiCookieManager.promises._populateServerIdViaRequest
        .calledWith(ctx.project_id, ctx.user_id)
        .should.equal(true)
    })

    it('should _populateServerIdViaRequest if no key is blank', async function (ctx) {
      ctx.ClsiCookieManager.promises._populateServerIdViaRequest = sinon
        .stub()
        .resolves(null)
      ctx.redis.get.resolves('')
      await ctx.ClsiCookieManager.promises.getServerId(
        ctx.project_id,
        ctx.user_id,
        '',
        'c3d'
      )
      ctx.ClsiCookieManager.promises._populateServerIdViaRequest
        .calledWith(ctx.project_id, ctx.user_id)
        .should.equal(true)
    })
  })

  describe('_populateServerIdViaRequest', function () {
    beforeEach(function (ctx) {
      ctx.clsiServerId = 'server-id'
      ctx.ClsiCookieManager.promises.setServerId = sinon.stub().resolves()
    })

    describe('with a server id in the response', function () {
      beforeEach(function (ctx) {
        ctx.response = {
          headers: {
            'set-cookie': [
              `${ctx.settings.clsiCookie.key}=${ctx.clsiServerId}`,
            ],
          },
        }
        ctx.fetchUtils.fetchNothing.returns(ctx.response)
      })

      it('should make a request to the clsi', async function (ctx) {
        await ctx.ClsiCookieManager.promises._populateServerIdViaRequest(
          ctx.project_id,
          ctx.user_id,
          'standard',
          'c3d'
        )
        const args = ctx.ClsiCookieManager.promises.setServerId.args[0]
        args[0].should.equal(ctx.project_id)
        args[1].should.equal(ctx.user_id)
        args[2].should.equal('standard')
        args[3].should.equal('c3d')
        args[4].should.deep.equal(ctx.clsiServerId)
      })

      it('should return the server id', async function (ctx) {
        const serverId =
          await ctx.ClsiCookieManager.promises._populateServerIdViaRequest(
            ctx.project_id,
            ctx.user_id,
            '',
            'c3d'
          )
        serverId.should.equal(ctx.clsiServerId)
      })
    })

    describe('without a server id in the response', function () {
      beforeEach(function (ctx) {
        ctx.response = { headers: {} }
        ctx.fetchUtils.fetchNothing.returns(ctx.response)
      })
      it('should not set the server id there is no server id in the response', async function (ctx) {
        ctx.ClsiCookieManager._parseServerIdFromResponse = sinon
          .stub()
          .returns(null)
        await ctx.ClsiCookieManager.promises.setServerId(
          ctx.project_id,
          ctx.user_id,
          'standard',
          'c3d',
          ctx.clsiServerId,
          null
        )
        ctx.redis.setex.called.should.equal(false)
      })
    })
  })

  describe('clearServerId', function () {
    it('should clear the key', async function (ctx) {
      await ctx.ClsiCookieManager.promises.clearServerId(
        ctx.project_id,
        ctx.user_id,
        'c3d'
      )
      ctx.redis.del.should.have.been.calledWith(
        `clsiserver:c3d:${ctx.project_id}:${ctx.user_id}`
      )
    })
  })

  describe('setServerId', function () {
    beforeEach(function (ctx) {
      ctx.clsiServerId = 'server-id'
      ctx.ClsiCookieManager._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
    })

    it('should set the server id with a ttl', async function (ctx) {
      await ctx.ClsiCookieManager.promises.setServerId(
        ctx.project_id,
        ctx.user_id,
        'standard',
        'c3d',
        ctx.clsiServerId,
        null
      )
      ctx.redis.setex.should.have.been.calledWith(
        `clsiserver:c3d:${ctx.project_id}:${ctx.user_id}`,
        ctx.settings.clsiCookie.ttlInSeconds,
        ctx.clsiServerId
      )
    })

    it('should set the server id with the regular ttl for reg instance', async function (ctx) {
      ctx.clsiServerId = 'clsi-reg-8'
      await ctx.ClsiCookieManager.promises.setServerId(
        ctx.project_id,
        ctx.user_id,
        'standard',
        'c3d',
        ctx.clsiServerId,
        null
      )
      expect(ctx.redis.setex).to.have.been.calledWith(
        `clsiserver:c3d:${ctx.project_id}:${ctx.user_id}`,
        ctx.settings.clsiCookie.ttlInSecondsRegular,
        ctx.clsiServerId
      )
    })

    describe('when clsiCookies are not enabled', function (ctx) {
      let oldKey
      beforeEach(async function (ctx) {
        oldKey = ctx.settings.clsiCookie.key
        delete ctx.settings.clsiCookie.key
        vi.resetModules()
        ctx.ClsiCookieManager2 = (await import(modulePath)).default()
      })
      afterEach(function (ctx) {
        ctx.settings.clsiCookie.key = oldKey
      })

      it('should not set the server id if clsiCookies are not enabled', async function (ctx) {
        await ctx.ClsiCookieManager2.promises.setServerId(
          ctx.project_id,
          ctx.user_id,
          'standard',
          'c3d',
          ctx.clsiServerId,
          null
        )
        ctx.redis.setex.called.should.equal(false)
      })
    })

    it('should also set in the secondary if secondary redis is enabled', async function (ctx) {
      ctx.redis_secondary = { setex: sinon.stub().resolves() }
      ctx.settings.redis.clsi_cookie_secondary = {}
      ctx.RedisWrapper.client = sinon.stub()
      ctx.RedisWrapper.client.withArgs('clsi_cookie').returns(ctx.redis)
      ctx.RedisWrapper.client
        .withArgs('clsi_cookie_secondary')
        .returns(ctx.redis_secondary)
      vi.resetModules()
      ctx.ClsiCookieManager2 = (await import(modulePath)).default()
      ctx.ClsiCookieManager2._parseServerIdFromResponse = sinon
        .stub()
        .returns('clsi-8')
      await ctx.ClsiCookieManager2.promises.setServerId(
        ctx.project_id,
        ctx.user_id,
        'standard',
        'c3d',
        ctx.clsiServerId,
        null
      )
      ctx.redis_secondary.setex.should.have.been.calledWith(
        `clsiserver:c3d:${ctx.project_id}:${ctx.user_id}`,
        ctx.settings.clsiCookie.ttlInSeconds,
        ctx.clsiServerId
      )
    })

    describe('checkIsLoadSheddingEvent', function () {
      beforeEach(function (ctx) {
        ctx.fetchUtils.fetchStringWithResponse.reset()
        ctx.call = async () => {
          await ctx.ClsiCookieManager.promises.setServerId(
            ctx.project_id,
            ctx.user_id,
            'standard',
            'c3d',
            ctx.clsiServerId,
            'previous-clsi-server-id'
          )
          expect(
            ctx.fetchUtils.fetchStringWithResponse
          ).to.have.been.calledWith(
            `${ctx.settings.apis.clsi.url}/instance-state?clsiserverid=previous-clsi-server-id&compileGroup=standard&compileBackendClass=c3d`,
            { method: 'GET', signal: sinon.match.instanceOf(AbortSignal) }
          )
        }
      })

      it('should report "load-shedding" when previous is UP', async function (ctx) {
        ctx.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 200 },
          body: 'previous-clsi-server-id,UP\n',
        })
        await ctx.call()
        expect(ctx.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'load-shedding' }
        )
      })

      it('should report "cycle" when other is UP', async function (ctx) {
        ctx.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 200 },
          body: 'other-clsi-server-id,UP\n',
        })
        await ctx.call()
        expect(ctx.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'cycle' }
        )
      })

      it('should report "cycle" when previous is 404', async function (ctx) {
        ctx.fetchUtils.fetchStringWithResponse.resolves({
          response: { status: 404 },
        })
        await ctx.call()
        expect(ctx.metrics.inc).to.have.been.calledWith(
          'clsi-lb-switch-backend',
          1,
          { status: 'cycle' }
        )
      })
    })
  })
})
