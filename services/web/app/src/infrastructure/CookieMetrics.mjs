import Settings from '@overleaf/settings'
import metrics from '@overleaf/metrics'

/**
 * Middleware function to record session cookie metrics.  This allows us to
 * detect whether users are sending valid signed cookies, cookies with invalid
 * signatures (e.g. using an old key), or no cookies at all.
 *
 * Signed cookies begin with the prefix 's:'.  If the signature fails to verify,
 * the signed cookie value is returned as false.
 */
function middleware(req, res, next) {
  const cookieName = Settings.cookieName
  const cookie = req.cookies && req.cookies[cookieName]
  const signedCookie = req.signedCookies && req.signedCookies[cookieName]
  let status
  if (signedCookie) {
    status = 'signed'
  } else if (signedCookie === false) {
    status = 'bad-signature'
  } else if (cookie) {
    status = 'unsigned'
  } else {
    status = 'none'
  }
  metrics.inc('session.cookie', 1, { status })
  next()
}

export default { middleware }
