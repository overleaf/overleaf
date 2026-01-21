import workerpool from 'workerpool'
import ContentCacheManager from './ContentCacheManager.js'

workerpool.worker(ContentCacheManager.promises)
