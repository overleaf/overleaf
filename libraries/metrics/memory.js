/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// record memory usage each minute and run a periodic gc(), keeping cpu
// usage within allowable range of 1ms per minute. Also, dynamically
// adjust the period between gc()'s to reach a target of the gc saving
// 4 megabytes each time.

let MemoryMonitor
const oneMinute = 60 * 1000
const oneMegaByte = 1024 * 1024

let CpuTimeBucket = 100 // current cpu time allowance in milliseconds
const CpuTimeBucketMax = 100 // maximum amount of cpu time allowed in bucket
const CpuTimeBucketRate = 10 // add this many milliseconds per minute

let gcInterval = 1 // how many minutes between gc (parameter is dynamically adjusted)
let countSinceLastGc = 0 // how many minutes since last gc
const MemoryChunkSize = 4 // how many megabytes we need to free to consider gc worth doing

const readyToGc = function () {
  // update allowed cpu time
  CpuTimeBucket = CpuTimeBucket + CpuTimeBucketRate
  CpuTimeBucket =
    CpuTimeBucket < CpuTimeBucketMax ? CpuTimeBucket : CpuTimeBucketMax
  // update counts since last gc
  countSinceLastGc = countSinceLastGc + 1
  // check there is enough time since last gc and we have enough cpu
  return countSinceLastGc > gcInterval && CpuTimeBucket > 0
}

const executeAndTime = function (fn) {
  // time the execution of fn() and subtract from cpu allowance
  const t0 = process.hrtime()
  fn()
  const dt = process.hrtime(t0)
  const timeTaken = (dt[0] + dt[1] * 1e-9) * 1e3 // in milliseconds
  CpuTimeBucket -= Math.ceil(timeTaken)
  return timeTaken
}

const inMegaBytes = function (obj) {
  // convert process.memoryUsage hash {rss,heapTotal,heapFreed} into megabytes
  const result = {}
  for (const k in obj) {
    const v = obj[k]
    result[k] = (v / oneMegaByte).toFixed(2)
  }
  return result
}

const updateMemoryStats = function (oldMem, newMem) {
  countSinceLastGc = 0
  const delta = {}
  for (const k in newMem) {
    delta[k] = (newMem[k] - oldMem[k]).toFixed(2)
  }
  // take the max of all memory measures
  const savedMemory = Math.max(-delta.rss, -delta.heapTotal, -delta.heapUsed)
  delta.megabytesFreed = savedMemory
  // did it do any good?
  if (savedMemory < MemoryChunkSize) {
    gcInterval = gcInterval + 1 // no, so wait longer next time
  } else {
    gcInterval = Math.max(gcInterval - 1, 1) // yes, wait less time
  }
  return delta
}

module.exports = MemoryMonitor = {
  monitor(logger) {
    const interval = setInterval(() => MemoryMonitor.Check(logger), oneMinute)
    const Metrics = require('./index')
    return Metrics.registerDestructor(() => clearInterval(interval))
  },

  Check(logger) {
    let mem
    const Metrics = require('./index')
    const memBeforeGc = (mem = inMegaBytes(process.memoryUsage()))
    Metrics.gauge('memory.rss', mem.rss)
    Metrics.gauge('memory.heaptotal', mem.heapTotal)
    Metrics.gauge('memory.heapused', mem.heapUsed)
    Metrics.gauge('memory.gc-interval', gcInterval)
    // Metrics.gauge("memory.cpu-time-bucket", CpuTimeBucket)

    logger.debug(mem, 'process.memoryUsage()')

    if (global.gc != null && readyToGc()) {
      const gcTime = executeAndTime(global.gc).toFixed(2)
      const memAfterGc = inMegaBytes(process.memoryUsage())
      const deltaMem = updateMemoryStats(memBeforeGc, memAfterGc)
      logger.debug(
        {
          gcTime,
          memBeforeGc,
          memAfterGc,
          deltaMem,
          gcInterval,
          CpuTimeBucket,
        },
        'global.gc() forced'
      )
      // Metrics.timing("memory.gc-time", gcTime)
      Metrics.gauge('memory.gc-rss-freed', -deltaMem.rss)
      Metrics.gauge('memory.gc-heaptotal-freed', -deltaMem.heapTotal)
      return Metrics.gauge('memory.gc-heapused-freed', -deltaMem.heapUsed)
    }
  },
}
