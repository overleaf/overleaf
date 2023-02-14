const Metrics = require('@overleaf/metrics')

function recordCheckResult(req, res) {
  Metrics.count('user_content_domain_check', req.body.succeeded, 1, {
    status: 'success',
  })
  Metrics.count('user_content_domain_check', req.body.failed, 1, {
    status: 'failure',
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
