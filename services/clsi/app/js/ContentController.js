const Path = require('node:path')
const send = require('send')
const Settings = require('@overleaf/settings')
const OutputCacheManager = require('./OutputCacheManager')

const ONE_DAY_S = 24 * 60 * 60
const ONE_DAY_MS = ONE_DAY_S * 1000

function getPdfRange(req, res, next) {
  const { projectId, userId, contentId, hash } = req.params
  const perUserDir = userId ? `${projectId}-${userId}` : projectId
  const path = Path.join(
    Settings.path.outputDir,
    perUserDir,
    OutputCacheManager.CONTENT_SUBDIR,
    contentId,
    hash
  )
  res.setHeader('cache-control', `public, max-age=${ONE_DAY_S}`)
  res.setHeader('expires', new Date(Date.now() + ONE_DAY_MS).toUTCString())
  send(req, path).pipe(res)
}

module.exports = { getPdfRange }
