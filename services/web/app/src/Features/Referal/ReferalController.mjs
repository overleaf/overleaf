import ReferalHandler from './ReferalHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'

export default {
  bonus(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    ReferalHandler.getReferedUsers(userId, (err, { referedUserCount }) => {
      if (err) {
        next(err)
      } else {
        res.render('referal/bonus', {
          refered_user_count: referedUserCount,
        })
      }
    })
  },
}
