const ReferalHandler = require('./ReferalHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = {
  bonus(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    ReferalHandler.getReferedUsers(
      userId,
      (err, referedUsers, referedUserCount) => {
        if (err) {
          next(err)
        } else {
          res.render('referal/bonus', {
            title: 'bonus_please_recommend_us',
            refered_users: referedUsers,
            refered_user_count: referedUserCount
          })
        }
      }
    )
  }
}
