const SandboxedModule = require('sandboxed-module')
const { expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/WebsocketAddressManager'
)

describe('WebsocketAddressManager', function () {
  beforeEach(function () {
    this.WebsocketAddressManager = SandboxedModule.require(modulePath, {
      requires: {},
    })
  })

  describe('with a proxy configuration', function () {
    beforeEach(function () {
      this.websocketAddressManager = new this.WebsocketAddressManager(
        true,
        '127.0.0.1'
      )
    })

    it('should return the client ip address when behind a proxy', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '123.45.67.89',
          },
          address: { address: '127.0.0.1' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return the client ip address for a direct connection', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return the client ip address when there are no headers in the handshake', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return a "client-handshake-missing" response when the handshake is missing', function () {
      expect(this.websocketAddressManager.getRemoteIp()).to.equal(
        'client-handshake-missing'
      )
    })
  })

  describe('without a proxy configuration', function () {
    beforeEach(function () {
      this.websocketAddressManager = new this.WebsocketAddressManager(false)
    })

    it('should return the client ip address for a direct connection', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { address: '123.45.67.89' },
        })
      ).to.equal('123.45.67.89')
    })

    it('should return undefined if the client ip address is not present', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          headers: {},
          address: { otherAddressProperty: '123.45.67.89' },
        })
      ).to.be.undefined
    })

    it('should return the proxy ip address if there is actually a proxy', function () {
      expect(
        this.websocketAddressManager.getRemoteIp({
          headers: {
            'x-forwarded-proto': 'https',
            'x-forwarded-for': '123.45.67.89',
          },
          address: { address: '127.0.0.1' },
        })
      ).to.equal('127.0.0.1')
    })

    it('should return a "client-handshake-missing" response when the handshake is missing', function () {
      expect(this.websocketAddressManager.getRemoteIp()).to.equal(
        'client-handshake-missing'
      )
    })
  })
})
