import { z, parseReq } from '../../infrastructure/Validation.mjs'

// Mounted globally ahead of every route's own schema (see
// `webRouter.use(ReferalConnect.use)` in infrastructure/Server.mjs), so this
// stays a non-strict, best-effort read of a handful of short referral/
// affiliate tracking query params -- rejecting/stripping fields that belong
// to the route's own schema isn't this middleware's job. `rm`/`rs` values
// outside the switch statements below are silently tolerated (left
// unmapped), so those stay bare optional strings rather than z.enum(...).
const referalQuerySchema = z.object({
  query: z.object({
    referal: z.string().optional(),
    r: z.string().optional(),
    fb_ref: z.string().optional(),
    rm: z.string().optional(),
    rs: z.string().optional(),
  }),
})

export default {
  use(req, res, next) {
    const { query } = parseReq(req, referalQuerySchema, { logOnly: true })

    if (query.referal != null) {
      req.session.referal_id = query.referal
    } else if (query.r != null) {
      // Short hand for referal
      req.session.referal_id = query.r
    } else if (query.fb_ref != null) {
      req.session.referal_id = query.fb_ref
    }

    if (query.rm != null) {
      // referal medium e.g. twitter, facebook, email
      switch (query.rm) {
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

    if (query.rs != null) {
      // referal source e.g. project share, bonus
      switch (query.rs) {
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

    next()
  },
}
