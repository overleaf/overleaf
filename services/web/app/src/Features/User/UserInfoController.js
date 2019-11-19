let UserController
const UserGetter = require('./UserGetter')
const AuthenticationController = require('../Authentication/AuthenticationController')
const { ObjectId } = require('mongojs')

module.exports = UserController = {
  getLoggedInUsersPersonalInfo(req, res, next) {
    const userId = AuthenticationController.getLoggedInUserId(req)
    if (!userId) {
      return next(new Error('User is not logged in'))
    }
    UserGetter.getUser(
      userId,
      {
        first_name: true,
        last_name: true,
        role: true,
        institution: true,
        email: true,
        signUpDate: true
      },
      function(error, user) {
        if (error) {
          return next(error)
        }
        UserController.sendFormattedPersonalInfo(user, res, next)
      }
    )
  },

  getPersonalInfo(req, res, next) {
    let query
    const userId = req.params.user_id

    if (/^\d+$/.test(userId)) {
      query = { 'overleaf.id': parseInt(userId, 10) }
    } else if (/^[a-f0-9]{24}$/.test(userId)) {
      query = { _id: ObjectId(userId) }
    } else {
      return res.send(400)
    }

    UserGetter.getUser(
      query,
      { _id: true, first_name: true, last_name: true, email: true },
      function(error, user) {
        if (error) {
          return next(error)
        }
        if (!user) {
          return res.send(404)
        }
        UserController.sendFormattedPersonalInfo(user, res, next)
      }
    )
  },

  sendFormattedPersonalInfo(user, res, next) {
    const info = UserController.formatPersonalInfo(user)
    res.json(info)
  },

  formatPersonalInfo(user, callback) {
    if (!user) {
      return {}
    }
    const formattedUser = { id: user._id.toString() }
    for (let key of [
      'first_name',
      'last_name',
      'email',
      'signUpDate',
      'role',
      'institution'
    ]) {
      if (user[key]) {
        formattedUser[key] = user[key]
      }
    }
    return formattedUser
  }
}
