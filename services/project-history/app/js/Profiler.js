/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Settings from '@overleaf/settings'
import logger from '@overleaf/logger'
import metrics from '@overleaf/metrics'

const LOG_CUTOFF_TIME = 1000

const deltaMs = function (ta, tb) {
  const nanoSeconds = (ta[0] - tb[0]) * 1e9 + (ta[1] - tb[1])
  const milliSeconds = Math.floor(nanoSeconds * 1e-6)
  return milliSeconds
}

export class Profiler {
  constructor(name, args) {
    this.name = name
    this.args = args
    this.t0 = this.t = process.hrtime()
    this.start = new Date()
    this.updateTimes = []
  }

  log(label) {
    const t1 = process.hrtime()
    const dtMilliSec = deltaMs(t1, this.t)
    this.t = t1
    this.updateTimes.push([label, dtMilliSec]) // timings in ms
    return this // make it chainable
  }

  end(message) {
    const totalTime = deltaMs(this.t, this.t0)
    // record the update times in metrics
    for (const update of Array.from(this.updateTimes)) {
      metrics.timing(`profile.${this.name}.${update[0]}`, update[1])
    }
    if (totalTime > LOG_CUTOFF_TIME) {
      // log anything greater than cutoff
      const args = {}
      for (const k in this.args) {
        const v = this.args[k]
        args[k] = v
      }
      args.updateTimes = this.updateTimes
      args.start = this.start
      args.end = new Date()
      logger.debug(args, this.name)
    }
    return totalTime
  }

  getTimeDelta() {
    const lastIdx = this.updateTimes.length - 1
    if (lastIdx >= 0) {
      return this.updateTimes[lastIdx][1]
    } else {
      return 0
    }
  }

  wrap(label, fn) {
    // create a wrapped function which calls profile.log(label) before continuing execution
    const newFn = (...args) => {
      this.log(label)
      return fn(...Array.from(args || []))
    }
    return newFn
  }
}
