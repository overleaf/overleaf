/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let OpenSocketsMonitor;
const URL = require("url");
const seconds = 1000;

// In Node 0.10 the default is 5, which means only 5 open connections at one.
// Node 0.12 has a default of Infinity. Make sure we have no limit set,
// regardless of Node version.
require("http").globalAgent.maxSockets = Infinity;
require("https").globalAgent.maxSockets = Infinity;

module.exports = (OpenSocketsMonitor = {
	monitor(logger) {
		const interval = setInterval(() => OpenSocketsMonitor.gaugeOpenSockets()
		, 5 * seconds);
		const Metrics = require("./index");
		return Metrics.registerDestructor(() => clearInterval(interval));
	},

	gaugeOpenSockets() {
		let agents, hostname, url;
		const Metrics = require("./index");
		const object = require('http').globalAgent.sockets;
		for (url in object) {
			agents = object[url];
			url = URL.parse(`http://${url}`);
			hostname = url.hostname != null ? url.hostname.replace(/\./g, "_") : undefined;
			Metrics.gauge(`open_connections.http.${hostname}`, agents.length);
		}
		return (() => {
			const result = [];
			const object1 = require('https').globalAgent.sockets;
			for (url in object1) {
				agents = object1[url];
				url = URL.parse(`https://${url}`);
				hostname = url.hostname != null ? url.hostname.replace(/\./g, "_") : undefined;
				result.push(Metrics.gauge(`open_connections.https.${hostname}`, agents.length));
			}
			return result;
		})();
	}
});
