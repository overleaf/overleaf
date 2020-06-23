/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let HealthCheckManager;
const metrics = require("metrics-sharelatex");
const logger = require("logger-sharelatex");

const os = require("os");
const HOST = os.hostname();
const PID = process.pid;
let COUNT = 0;

const CHANNEL_MANAGER = {}; // hash of event checkers by channel name
const CHANNEL_ERROR = {}; // error status by channel name

module.exports = (HealthCheckManager = class HealthCheckManager {
    // create an instance of this class which checks that an event with a unique
    // id is received only once within a timeout
    constructor(channel, timeout) {
        // unique event string
        this.channel = channel;
        if (timeout == null) { timeout = 1000; }
        this.id = `host=${HOST}:pid=${PID}:count=${COUNT++}`;
        // count of number of times the event is received
        this.count = 0; 
        // after a timeout check the status of the count
        this.handler = setTimeout(() => {
            return this.setStatus();
        }
        , timeout);
        // use a timer to record the latency of the channel
        this.timer = new metrics.Timer(`event.${this.channel}.latency`);
        // keep a record of these objects to dispatch on
        CHANNEL_MANAGER[this.channel] = this;
    }
    processEvent(id) {
        // if this is our event record it
        if (id === this.id) {
            this.count++;
            if (this.timer != null) {
                this.timer.done();
            }
            return this.timer = null; // only time the latency of the first event
        }
    }
    setStatus() {
        // if we saw the event anything other than a single time that is an error
        if (this.count !== 1) {
            logger.err({channel:this.channel, count:this.count, id:this.id}, "redis channel health check error");
        }
        const error = (this.count !== 1);
        return CHANNEL_ERROR[this.channel] = error;
    }

    // class methods
    static check(channel, id) {
        // dispatch event to manager for channel
        return (CHANNEL_MANAGER[channel] != null ? CHANNEL_MANAGER[channel].processEvent(id) : undefined);
    }
    static status() {
        // return status of all channels for logging
        return CHANNEL_ERROR;
    }
    static isFailing() { 
        // check if any channel status is bad 
        for (let channel in CHANNEL_ERROR) {
            const error = CHANNEL_ERROR[channel];
            if (error === true) { return true; }
        }
        return false;
    }
});
