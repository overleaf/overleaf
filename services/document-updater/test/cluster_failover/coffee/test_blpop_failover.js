/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let listenInBackground, sendPings;
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
	return rclient1.rpush("test-blpop", counter, function(error) {
		if (error != null) { console.error("[SENDING ERROR]", error.message); }
		if ((error == null)) {
			counter += 1;
		}
		return cb();
	});
};

let previous = null;
const listenForPing = cb => rclient2.blpop("test-blpop", 200, function(error, result) {
    if (error != null) { return cb(error); }
    let [key, value] = Array.from(result);
    value = parseInt(value, 10);
    if ((value % 10) === 0) {
        console.log(".");
    }
    if ((previous != null) && (value !== (previous + 1))) {
        error = new Error(`Counter not in order. Got ${value}, expected ${previous + 1}`);
    }
    previous = value;
    return cb(error, value);
});

const PING_DELAY = 100;
(sendPings = () => sendPing(() => setTimeout(sendPings, PING_DELAY)))();

(listenInBackground = () => listenForPing(function(error, value) {
    if (error) { console.error("[RECEIVING ERROR]", error.message); }
    return setTimeout(listenInBackground);
}))();
