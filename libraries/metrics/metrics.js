/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Metrics;
console.log("using prometheus");

const prom = require('./prom_wrapper');

const {
    collectDefaultMetrics
} = prom;

let appname = "unknown";
const hostname = require('os').hostname();

const destructors = [];

require("./uv_threadpool_size");

module.exports = (Metrics = {
	register: prom.registry,

	initialize(_name, opts) {
		if (opts == null) { opts = {}; }
		appname = _name;
		collectDefaultMetrics({ timeout: 5000, prefix: Metrics.buildPromKey()});
		if (opts.ttlInMinutes) {
			prom.ttlInMinutes = opts.ttlInMinutes;
		}

		console.log(`ENABLE_TRACE_AGENT set to ${process.env['ENABLE_TRACE_AGENT']}`);
		if (process.env['ENABLE_TRACE_AGENT'] === "true") {
			console.log("starting google trace agent");
			const traceAgent = require('@google-cloud/trace-agent');

			const traceOpts =
				{ignoreUrls: [/^\/status/, /^\/health_check/]};
			traceAgent.start(traceOpts);
		}

		console.log(`ENABLE_DEBUG_AGENT set to ${process.env['ENABLE_DEBUG_AGENT']}`);
		if (process.env['ENABLE_DEBUG_AGENT'] === "true") {
			console.log("starting google debug agent");
			const debugAgent = require('@google-cloud/debug-agent');
			debugAgent.start({
				allowExpressions: true,
				serviceContext: {
					service: appname,
					version: process.env['BUILD_VERSION']
				}
			});
		}

		console.log(`ENABLE_PROFILE_AGENT set to ${process.env['ENABLE_PROFILE_AGENT']}`);
		if (process.env['ENABLE_PROFILE_AGENT'] === "true") {
			console.log("starting google profile agent");
			const profiler = require('@google-cloud/profiler');
			profiler.start({
				serviceContext: {
					service: appname,
					version: process.env['BUILD_VERSION']
				}
			});
		}

		return Metrics.inc("process_startup");
	},

	registerDestructor(func) {
		return destructors.push(func);
	},

	injectMetricsRoute(app) {
		return app.get('/metrics', function(req, res) {
			res.set('Content-Type', prom.registry.contentType);
			return res.end(prom.registry.metrics());
		});
	},

	buildPromKey(key){
		if (key == null) { key = ""; }
		return key.replace(/[^a-zA-Z0-9]/g, "_");
	},

	sanitizeValue(value) {
		return parseFloat(value);
	},

	set(key, value, sampleRate){
		if (sampleRate == null) { sampleRate = 1; }
		return console.log("counts are not currently supported");
	},

	inc(key, sampleRate, opts){
		if (sampleRate == null) { sampleRate = 1; }
		if (opts == null) { opts = {}; }
		key = Metrics.buildPromKey(key);
		opts.app = appname;
		opts.host = hostname;
		prom.metric('counter', key).inc(opts);
		if (process.env['DEBUG_METRICS']) {
			return console.log("doing inc", key, opts);
		}
	},

	count(key, count, sampleRate, opts){
		if (sampleRate == null) { sampleRate = 1; }
		if (opts == null) { opts = {}; }
		key = Metrics.buildPromKey(key);
		opts.app = appname;
		opts.host = hostname;
		prom.metric('counter', key).inc(opts, count);
		if (process.env['DEBUG_METRICS']) {
			return console.log("doing count/inc", key, opts);
		}
	},

	summary(key, value, opts){
		if (opts == null) { opts = {}; }
		key = Metrics.buildPromKey(key);
		opts.app = appname;
		opts.host = hostname;
		prom.metric('summary', key).observe(opts, value);
		if (process.env['DEBUG_METRICS']) {
			return console.log("doing summary", key, value, opts);
		}
	},

	timing(key, timeSpan, sampleRate, opts){
		if (opts == null) { opts = {}; }
		key = Metrics.buildPromKey("timer_" + key);
		opts.app = appname;
		opts.host = hostname;
		prom.metric('summary', key).observe(opts, timeSpan);
		if (process.env['DEBUG_METRICS']) {
			return console.log("doing timing", key, opts);
		}
	},

	Timer : class {
		constructor(key, sampleRate, opts){
			if (sampleRate == null) { sampleRate = 1; }
			this.start = new Date();
			key = Metrics.buildPromKey(key);
			this.key = key;
			this.sampleRate = sampleRate;
			this.opts = opts;
		}

		done() {
			const timeSpan = new Date - this.start;
			Metrics.timing(this.key, timeSpan, this.sampleRate, this.opts);
			return timeSpan;
		}
	},

	gauge(key, value, sampleRate, opts){
		if (sampleRate == null) { sampleRate = 1; }
		key = Metrics.buildPromKey(key);
		prom.metric('gauge', key).set({app: appname, host: hostname, status: (opts != null ? opts.status : undefined)}, this.sanitizeValue(value));
		if (process.env['DEBUG_METRICS']) {
			return console.log("doing gauge", key, opts);
		}
	},

	globalGauge(key, value, sampleRate, opts){
		if (sampleRate == null) { sampleRate = 1; }
		key = Metrics.buildPromKey(key);
		return prom.metric('gauge', key).set({app: appname, status: (opts != null ? opts.status : undefined)},this.sanitizeValue(value));
	},

	mongodb: require("./mongodb"),
	http: require("./http"),
	open_sockets: require("./open_sockets"),
	event_loop: require("./event_loop"),
	memory: require("./memory"),

	timeAsyncMethod: require('./timeAsyncMethod'),

	close() {
		return Array.from(destructors).map((func) =>
			func());
	}
});
