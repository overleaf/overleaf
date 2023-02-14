const Metrics = require('@overleaf/metrics')

function recordCheckResult(req, res) {
  const path = req.body.isOldDomain ? 'old' : ''
  Metrics.count('user_content_domain_check', req.body.succeeded, 1, {
    status: 'success',
    path,
  })
  Metrics.count('user_content_domain_check', req.body.failed, 1, {
    status: 'failure',
    path,
  })
  res.sendStatus(204)
}

function recordFallbackUsage(_req, res) {
  Metrics.inc('user_content_domain_fallback')
  res.sendStatus(204)
}

function recordMaxAccessChecksHit(_req, res) {
  Metrics.inc('user_content_domain_max_access_checks_hit')
  res.sendStatus(204)
}

module.exports = {
  recordCheckResult,
  recordFallbackUsage,
  recordMaxAccessChecksHit,
}
