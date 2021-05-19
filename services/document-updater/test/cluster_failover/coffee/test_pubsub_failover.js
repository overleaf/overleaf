/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let sendPings;
const redis = require("@overleaf/redis-wrapper");
const rclient1 = redis.createClient({cluster: [{
	port: "7000",
	host: "localhost"
}]});

const rclient2 = redis.createClient({cluster: [{
	port: "7000",
	host: "localhost"
}]});

let counter = 0;
const sendPing = function(cb) {
	if (cb == null) { cb = function() {}; }
	return rclient1.publish("test-pubsub", counter, function(error) {
		if (error != null) { console.error("[SENDING ERROR]", error.message); }
		if ((error == null)) {
			counter += 1;
		}
		return cb();
	});
};

let previous = null;
rclient2.subscribe("test-pubsub");
rclient2.on("message", function(channel, value) {
	value = parseInt(value, 10);
	if ((value % 10) === 0) {
		console.log(".");
	}
	if ((previous != null) && (value !== (previous + 1))) {
		console.error("[RECEIVING ERROR]", `Counter not in order. Got ${value}, expected ${previous + 1}`);
	}
	return previous = value;
});

const PING_DELAY = 100;
(sendPings = () => sendPing(() => setTimeout(sendPings, PING_DELAY)))();
