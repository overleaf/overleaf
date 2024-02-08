const ReferalHandler = require('./ReferalHandler')
const SessionManager = require('../Authentication/SessionManager')

module.exports = {
  bonus(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    ReferalHandler.getReferedUsers(
      userId,
      (err, { referedUsers, referedUserCount }) => {
        if (err) {
          next(err)
        } else {
          res.render('referal/bonus', {
            title: 'bonus_please_recommend_us',
            refered_users: referedUsers,
            refered_user_count: referedUserCount,
          })
        }
      }
    )
  },
}
