import metrics from '@overleaf/metrics'
import logger from '@overleaf/logger'
import os from 'node:os'
const HOST = os.hostname()
const PID = process.pid
let COUNT = 0

const CHANNEL_MANAGER = {} // hash of event checkers by channel name
const CHANNEL_ERROR = {} // error status by channel name

export default class HealthCheckManager {
  // create an instance of this class which checks that an event with a unique
  // id is received only once within a timeout
  constructor(channel, timeout) {
    // unique event string
    this.channel = channel
    this.id = `host=${HOST}:pid=${PID}:count=${COUNT++}`
    // count of number of times the event is received
    this.count = 0
    // after a timeout check the status of the count
    this.handler = setTimeout(() => {
      this.setStatus()
    }, timeout || 1000)
    // use a timer to record the latency of the channel
    this.timer = new metrics.Timer(`event.${this.channel}.latency`)
    // keep a record of these objects to dispatch on
    CHANNEL_MANAGER[this.channel] = this
  }

  processEvent(id) {
    // if this is our event record it
    if (id === this.id) {
      this.count++
      if (this.timer) {
        this.timer.done()
      }
      this.timer = undefined // only time the latency of the first event
    }
  }

  setStatus() {
    // if we saw the event anything other than a single time that is an error
    const isFailing = this.count !== 1
    if (isFailing) {
      logger.err(
        { channel: this.channel, count: this.count, id: this.id },
        'redis channel health check error'
      )
    }
    CHANNEL_ERROR[this.channel] = isFailing
  }

  // class methods
  static check(channel, id) {
    // dispatch event to manager for channel
    if (CHANNEL_MANAGER[channel]) {
      CHANNEL_MANAGER[channel].processEvent(id)
    }
  }

  static status() {
    // return status of all channels for logging
    return CHANNEL_ERROR
  }

  static isFailing() {
    // check if any channel status is bad
    for (const channel in CHANNEL_ERROR) {
      const error = CHANNEL_ERROR[channel]
      if (error === true) {
        return true
      }
    }
    return false
  }
}
