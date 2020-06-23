/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DrainManager;
const logger = require("logger-sharelatex");

module.exports = (DrainManager = {

	startDrainTimeWindow(io, minsToDrain){
		const drainPerMin = io.sockets.clients().length / minsToDrain;
		return DrainManager.startDrain(io, Math.max(drainPerMin / 60, 4));
	}, // enforce minimum drain rate

	startDrain(io, rate) {
		// Clear out any old interval
		let pollingInterval;
		clearInterval(this.interval);
		logger.log({rate}, "starting drain");
		if (rate === 0) {
			return;
		} else if (rate < 1) {
			// allow lower drain rates
			// e.g. rate=0.1 will drain one client every 10 seconds
			pollingInterval = 1000 / rate;
			rate = 1;
		} else {
			pollingInterval = 1000;
		}
		return this.interval = setInterval(() => {
			return this.reconnectNClients(io, rate);
		}
		, pollingInterval);
	},

	RECONNECTED_CLIENTS: {},
	reconnectNClients(io, N) {
		let drainedCount = 0;
		for (const client of Array.from(io.sockets.clients())) {
			if (!this.RECONNECTED_CLIENTS[client.id]) {
				this.RECONNECTED_CLIENTS[client.id] = true;
				logger.log({client_id: client.id}, "Asking client to reconnect gracefully");
				client.emit("reconnectGracefully");
				drainedCount++;
			}
			const haveDrainedNClients = (drainedCount === N);
			if (haveDrainedNClients) {
				break;
			}
		}
		if (drainedCount < N) {
			return logger.log("All clients have been told to reconnectGracefully");
		}
	}
});
