const ContentCacheManager = require('../../app/js/ContentCacheManager')
const fs = require('node:fs')
const crypto = require('node:crypto')
const path = require('node:path')
const os = require('node:os')
const async = require('async')
const _createHash = crypto.createHash

const files = process.argv.slice(2)

function test(hashType, filePath, callback) {
  // override the default hash in ContentCacheManager
  crypto.createHash = function (hash) {
    if (hashType === 'hmac-sha1') {
      return crypto.createHmac('sha1', 'a secret')
    }
    hash = hashType
    return _createHash(hash)
  }
  fs.mkdtemp(path.join(os.tmpdir(), 'pdfcache'), (err, dir) => {
    if (err) {
      return callback(err)
    }
    const t0 = process.hrtime.bigint()
    ContentCacheManager.update(dir, filePath, x => {
      const t1 = process.hrtime.bigint()
      const cold = Number(t1 - t0) / 1e6
      ContentCacheManager.update(dir, filePath, x => {
        const t2 = process.hrtime.bigint()
        const warm = Number(t2 - t1) / 1e6
        fs.rm(dir, { recursive: true, force: true }, err => {
          if (err) {
            return callback(err)
          }
          console.log(
            'uvthreads',
            process.env.UV_THREADPOOL_SIZE,
            filePath,
            'hashType',
            hashType,
            'cold-start',
            cold.toFixed(2),
            'ms',
            'warm-start',
            warm.toFixed(2),
            'ms'
          )
          callback(null, [hashType, cold, warm])
        })
      })
    })
  })
}

const jobs = []
files.forEach(file => {
  jobs.push(cb => {
    test('md5', file, cb)
  })
  jobs.push(cb => {
    test('sha1', file, cb)
  })
  jobs.push(cb => {
    test('hmac-sha1', file, cb)
  })
  jobs.push(cb => {
    test('sha256', file, cb)
  })
})

async.timesSeries(10, (n, cb) => {
  async.series(jobs, cb)
})
