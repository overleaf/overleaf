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
require('node:http').globalAgent.maxSockets = Infinity
require('node:https').globalAgent.maxSockets = Infinity

const SOCKETS_HTTP = require('node:http').globalAgent.sockets
const SOCKETS_HTTPS = require('node:https').globalAgent.sockets
const FREE_SOCKETS_HTTP = require('node:http').globalAgent.freeSockets
const FREE_SOCKETS_HTTPS = require('node:https').globalAgent.freeSockets

// keep track of set gauges and reset them in the next collection cycle
const SEEN_HOSTS_HTTP = new Set()
const SEEN_HOSTS_HTTPS = new Set()
const FREE_SEEN_HOSTS_HTTP = new Set()
const FREE_SEEN_HOSTS_HTTPS = new Set()

function collectConnectionsCount(
  sockets,
  seenHosts,
  status,
  https,
  emitLegacyMetric
) {
  const Metrics = require('./index')
  Object.keys(sockets).forEach(host => seenHosts.add(host))
  seenHosts.forEach(host => {
    // host: 'HOST:PORT:'
    const hostname = host.split(':')[0]
    const openConnections = (sockets[host] || []).length
    if (!openConnections) {
      seenHosts.delete(host)
    }
    Metrics.gauge('sockets', openConnections, 1, {
      path: hostname,
      method: https,
      status,
    })
    if (status === 'open' && emitLegacyMetric) {
      // Emit legacy metric to keep old time series intact.
      Metrics.gauge(
        `${status}_connections.${https}.${hostname}`,
        openConnections
      )
    }
  })
}

module.exports = OpenSocketsMonitor = {
  monitor(emitLegacyMetric) {
    const interval = setInterval(
      () => OpenSocketsMonitor.gaugeOpenSockets(emitLegacyMetric),
      5 * seconds
    )
    const Metrics = require('./index')
    return Metrics.registerDestructor(() => clearInterval(interval))
  },

  gaugeOpenSockets(emitLegacyMetric) {
    collectConnectionsCount(
      SOCKETS_HTTP,
      SEEN_HOSTS_HTTP,
      'open',
      'http',
      emitLegacyMetric
    )
    collectConnectionsCount(
      SOCKETS_HTTPS,
      SEEN_HOSTS_HTTPS,
      'open',
      'https',
      emitLegacyMetric
    )
    collectConnectionsCount(
      FREE_SOCKETS_HTTP,
      FREE_SEEN_HOSTS_HTTP,
      'free',
      'http',
      false
    )
    collectConnectionsCount(
      FREE_SOCKETS_HTTPS,
      FREE_SEEN_HOSTS_HTTPS,
      'free',
      'https',
      false
    )
  },
}
