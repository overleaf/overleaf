import { expect, describe, beforeEach, it } from 'vitest'
import path from 'node:path'

const modulePath = path.join(
  import.meta.dirname,
  '../../../app/js/WebsocketAddressManager'
)

describe('WebsocketAddressManager', function () {
  beforeEach(async function (ctx) {
    ctx.WebsocketAddressManager = (await import(modulePath)).default
  })

  describe('with a proxy configuration', function () {
    beforeEach(function (ctx) {
      ctx.websocketAddressManager = new ctx.WebsocketAddressManager(
        true,
        '127.0.0.1'
      )
    })

    it('should return the client ip address when behind a proxy', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '123.45.67.89',
          },
          address: { address: '127.0.0.1' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return the client ip address for a direct connection', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return the client ip address when there are no headers in the handshake', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return a "client-handshake-missing" response when the handshake is missing', function (ctx) {
      expect(ctx.websocketAddressManager.getRemoteIp()).to.equal(
        'client-handshake-missing'
      )
    })
  })

  describe('without a proxy configuration', function () {
    beforeEach(function (ctx) {
      ctx.websocketAddressManager = new ctx.WebsocketAddressManager(false)
    })

    it('should return the client ip address for a direct connection', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return undefined if the client ip address is not present', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { otherAddressProperty: '123.45.67.89' },
        })
      ).to.be.undefined
    })

    it('should return the proxy ip address if there is actually a proxy', function (ctx) {
      expect(
        ctx.websocketAddressManager.getRemoteIp({
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '123.45.67.89',
          },
          address: { address: '127.0.0.1' },
        })
      ).to.equal('127.0.0.1')
    })

    it('should return a "client-handshake-missing" response when the handshake is missing', function (ctx) {
      expect(ctx.websocketAddressManager.getRemoteIp()).to.equal(
        'client-handshake-missing'
      )
    })
  })
})
