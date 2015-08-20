# record memory usage each minute and run a periodic gc(), keeping cpu
# usage within allowable range of 1ms per minute. Also, dynamically
# adjust the period between gc()'s to reach a target of the gc saving
# 4 megabytes each time.

oneMinute = 60 * 1000
oneMegaByte = 1024 * 1024

CpuTimeBucket = 100 # current cpu time allowance in milliseconds
CpuTimeBucketMax = 100 # maximum amount of cpu time allowed in bucket
CpuTimeBucketRate = 10 # add this many milliseconds per minute

gcInterval = 1 # how many minutes between gc (parameter is dynamically adjusted)
countSinceLastGc = 0 # how many minutes since last gc
MemoryChunkSize = 4 # how many megabytes we need to free to consider gc worth doing

readyToGc = () ->
	# update allowed cpu time
	CpuTimeBucket = CpuTimeBucket + CpuTimeBucketRate
	CpuTimeBucket = if CpuTimeBucket < CpuTimeBucketMax then CpuTimeBucket else CpuTimeBucketMax
	# update counts since last gc
	countSinceLastGc = countSinceLastGc + 1
	# check there is enough time since last gc and we have enough cpu
	return (countSinceLastGc > gcInterval) && (CpuTimeBucket > 0)

executeAndTime = (fn) ->
	# time the execution of fn() and subtract from cpu allowance
	t0 = process.hrtime()
	fn()
	dt = process.hrtime(t0)
	timeTaken = (dt[0] + dt[1]*1e-9) * 1e3 # in milliseconds
	CpuTimeBucket -= Math.ceil timeTaken
	return timeTaken

inMegaBytes = (obj) ->
	# convert process.memoryUsage hash {rss,heapTotal,heapFreed} into megabytes
	result = {}
	for k, v of obj
		result[k] = (v / oneMegaByte).toFixed(2)
	return result

updateMemoryStats = (oldMem, newMem) ->
	countSinceLastGc = 0
	delta = {}
	for k of newMem
		delta[k] = (newMem[k] - oldMem[k]).toFixed(2)
	# take the max of all memory measures
	savedMemory = Math.max -delta.rss, -delta.heapTotal, -delta.heapUsed
	delta.megabytesFreed = savedMemory
	# did it do any good?
	if savedMemory < MemoryChunkSize
		gcInterval = gcInterval + 1 # no, so wait longer next time
	else
		gcInterval = Math.max gcInterval - 1, 1 # yes, wait less time
	return delta

module.exports = MemoryMonitor =
	monitor: (logger) ->
		interval = setInterval () ->
			MemoryMonitor.Check(logger)
		, oneMinute
		Metrics = require "./metrics"
		Metrics.registerDestructor () ->
			clearInterval(interval)

	Check: (logger) ->
		Metrics = require "./metrics"
		memBeforeGc = mem = inMegaBytes process.memoryUsage()
		Metrics.gauge("memory.rss", mem.rss)
		Metrics.gauge("memory.heaptotal", mem.heapTotal)
		Metrics.gauge("memory.heapused", mem.heapUsed)
		Metrics.gauge("memory.gc-interval", gcInterval)
		#Metrics.gauge("memory.cpu-time-bucket", CpuTimeBucket)

		logger.log mem, "process.memoryUsage()"

		if global.gc? && readyToGc()
			gcTime = (executeAndTime global.gc).toFixed(2)
			memAfterGc = inMegaBytes process.memoryUsage()
			deltaMem = updateMemoryStats(memBeforeGc, memAfterGc)
			logger.log {gcTime, memBeforeGc, memAfterGc, deltaMem, gcInterval, CpuTimeBucket}, "global.gc() forced"
			#Metrics.timing("memory.gc-time", gcTime)
			Metrics.gauge("memory.gc-rss-freed", -deltaMem.rss)
			Metrics.gauge("memory.gc-heaptotal-freed", -deltaMem.heapTotal)
			Metrics.gauge("memory.gc-heapused-freed",  -deltaMem.heapUsed)
