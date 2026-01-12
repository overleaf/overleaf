import proxyaddr from 'proxy-addr'

export default class WebsocketAddressManager {
  constructor(behindProxy, trustedProxyIps) {
    if (behindProxy) {
      // parse trustedProxyIps comma-separated list the same way as express
      this.trust = proxyaddr.compile(
        trustedProxyIps ? trustedProxyIps.split(/ *, */) : []
      )
    }
  }

  getRemoteIp(clientHandshake) {
    if (!clientHandshake) {
      return 'client-handshake-missing'
    } else if (this.trust) {
      // create a dummy req object using the client handshake and
      // connection.remoteAddress for the proxy-addr module to parse
      try {
        const addressPort = clientHandshake.address
        const req = {
          headers: {
            'x-forwarded-for':
              clientHandshake.headers &&
              clientHandshake.headers['x-forwarded-for'],
          },
          connection: { remoteAddress: addressPort && addressPort.address },
        }
        // return the address parsed from x-forwarded-for
        return proxyaddr(req, this.trust)
      } catch (err) {
        return 'client-handshake-invalid'
      }
    } else {
      // return the address from the client handshake itself
      return clientHandshake.address && clientHandshake.address.address
    }
  }
}
