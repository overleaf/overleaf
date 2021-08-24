const workerpool = require('workerpool')
const ContentCacheManager = require('./ContentCacheManager')

workerpool.worker(ContentCacheManager.promises)
