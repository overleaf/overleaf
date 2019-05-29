/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = {
  use(req, res, next) {
    if (req.query != null) {
      if (req.query.referal != null) {
        req.session.referal_id = req.query.referal
      } else if (req.query.r != null) {
        // Short hand for referal
        req.session.referal_id = req.query.r
      } else if (req.query.fb_ref != null) {
        req.session.referal_id = req.query.fb_ref
      }

      if (req.query.rm != null) {
        // referal medium e.g. twitter, facebook, email
        switch (req.query.rm) {
          case 'fb':
            req.session.referal_medium = 'facebook'
            break
          case 't':
            req.session.referal_medium = 'twitter'
            break
          case 'gp':
            req.session.referal_medium = 'google_plus'
            break
          case 'e':
            req.session.referal_medium = 'email'
            break
          case 'd':
            req.session.referal_medium = 'direct'
            break
        }
      }

      if (req.query.rs != null) {
        // referal source e.g. project share, bonus
        switch (req.query.rs) {
          case 'b':
            req.session.referal_source = 'bonus'
            break
          case 'ps':
            req.session.referal_source = 'public_share'
            break
          case 'ci':
            req.session.referal_source = 'collaborator_invite'
            break
        }
      }
    }

    return next()
  }
}
