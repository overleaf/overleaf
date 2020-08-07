/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let EventLoopMonitor;
module.exports = (EventLoopMonitor = {
	monitor(logger, interval, log_threshold) {
		if (interval == null) { interval = 1000; }
		if (log_threshold == null) { log_threshold = 100; }
		const Metrics = require("./metrics");
		// check for logger on startup to avoid exceptions later if undefined
		if ((logger == null)) { throw new Error("logger is undefined"); }
		// monitor delay in setInterval to detect event loop blocking
		let previous = Date.now();
		const intervalId = setInterval(function() {
			const now = Date.now();
			const offset = now - previous - interval;
			if (offset > log_threshold) {
				logger.warn({offset}, "slow event loop");
			}
			previous = now;
			return Metrics.timing("event-loop-millsec", offset);
		}
		, interval);
		
		return Metrics.registerDestructor(() => clearInterval(intervalId));
	}
});
