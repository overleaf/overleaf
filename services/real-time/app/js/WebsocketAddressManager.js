const proxyaddr = require('proxy-addr')

module.exports = class WebsocketAddressManager {
  constructor(behindProxy, trustedProxyIps) {
    if (behindProxy) {
      // parse trustedProxyIps comma-separated list the same way as express
      this.trust = proxyaddr.compile(
        trustedProxyIps ? trustedProxyIps.split(/ *, */) : []
      )
    }
  }

  getRemoteIp(clientHandshake) {
    if (this.trust) {
      // create a dummy req object using the client handshake and
      // connection.remoteAddress for the proxy-addr module to parse
      const addressPort = clientHandshake.address
      const req = Object.create(clientHandshake, {
        connection: {
          value: { remoteAddress: addressPort && addressPort.address },
        },
      })
      // return the address parsed from x-forwarded-for
      return proxyaddr(req, this.trust)
    } else {
      // return the address from the client handshake itself
      return clientHandshake.address && clientHandshake.address.address
    }
  }
}
