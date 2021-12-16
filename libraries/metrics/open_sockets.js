/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let OpenSocketsMonitor
const seconds = 1000

// In Node 0.10 the default is 5, which means only 5 open connections at one.
// Node 0.12 has a default of Infinity. Make sure we have no limit set,
// regardless of Node version.
require('http').globalAgent.maxSockets = Infinity
require('https').globalAgent.maxSockets = Infinity

const SOCKETS_HTTP = require('http').globalAgent.sockets
const SOCKETS_HTTPS = require('https').globalAgent.sockets

// keep track of set gauges and reset them in the next collection cycle
const SEEN_HOSTS_HTTP = new Set()
const SEEN_HOSTS_HTTPS = new Set()

function collectOpenConnections(sockets, seenHosts, prefix) {
  const Metrics = require('./index')
  Object.keys(sockets).forEach(host => seenHosts.add(host))
  seenHosts.forEach(host => {
    // host: 'HOST:PORT:'
    const hostname = host.split(':')[0]
    const openConnections = (sockets[host] || []).length
    if (!openConnections) {
      seenHosts.delete(host)
    }
    Metrics.gauge(`open_connections.${prefix}.${hostname}`, openConnections)
  })
}

module.exports = OpenSocketsMonitor = {
  monitor(logger) {
    const interval = setInterval(
      () => OpenSocketsMonitor.gaugeOpenSockets(),
      5 * seconds
    )
    const Metrics = require('./index')
    return Metrics.registerDestructor(() => clearInterval(interval))
  },

  gaugeOpenSockets() {
    collectOpenConnections(SOCKETS_HTTP, SEEN_HOSTS_HTTP, 'http')
    collectOpenConnections(SOCKETS_HTTPS, SEEN_HOSTS_HTTPS, 'https')
  },
}
