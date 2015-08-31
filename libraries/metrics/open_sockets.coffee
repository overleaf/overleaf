URL = require "url"
seconds = 1000

# In Node 0.10 the default is 5, which means only 5 open connections at one.
# Node 0.12 has a default of Infinity. Make sure we have no limit set,
# regardless of Node version.
require("http").globalAgent.maxSockets = Infinity
require("https").globalAgent.maxSockets = Infinity

module.exports = OpenSocketsMonitor =
	monitor: (logger) ->
		interval = setInterval () ->
			OpenSocketsMonitor.gaugeOpenSockets()
		, 5 * seconds
		Metrics = require "./metrics"
		Metrics.registerDestructor () ->
			clearInterval(interval)

	gaugeOpenSockets: () ->
		Metrics = require "./metrics"
		for url, agents of require('http').globalAgent.sockets
			url = URL.parse("http://#{url}")
			hostname = url.hostname?.replace(/\./g, "_")
			Metrics.gauge "open_connections.http.#{hostname}", agents.length
		for url, agents of require('https').globalAgent.sockets
			url = URL.parse("https://#{url}")
			hostname = url.hostname?.replace(/\./g, "_")
			Metrics.gauge "open_connections.https.#{hostname}", agents.length
