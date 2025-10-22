import UserGetter from './UserGetter.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import mongodb from 'mongodb-legacy'
import { expressify } from '@overleaf/promise-utils'

const { ObjectId } = mongodb

function getLoggedInUsersPersonalInfo(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
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
      signUpDate: true,
    },
    function (error, user) {
      if (error) {
        return next(error)
      }
      sendFormattedPersonalInfo(user, res, next)
    }
  )
}

function getPersonalInfo(req, res, next) {
  let query
  const userId = req.params.user_id

  if (/^\d+$/.test(userId)) {
    query = { 'overleaf.id': parseInt(userId, 10) }
  } else if (/^[a-f0-9]{24}$/.test(userId)) {
    query = { _id: new ObjectId(userId) }
  } else {
    return res.sendStatus(400)
  }

  UserGetter.getUser(
    query,
    { _id: true, first_name: true, last_name: true, email: true },
    function (error, user) {
      if (error) {
        return next(error)
      }
      if (!user) {
        return res.sendStatus(404)
      }
      sendFormattedPersonalInfo(user, res, next)
    }
  )
}

function sendFormattedPersonalInfo(user, res, next) {
  const info = formatPersonalInfo(user)
  res.json(info)
}

function formatPersonalInfo(user) {
  if (!user) {
    return {}
  }
  const formattedUser = { id: user._id.toString() }
  for (const key of [
    'first_name',
    'last_name',
    'email',
    'signUpDate',
    'role',
    'institution',
  ]) {
    if (user[key]) {
      formattedUser[key] = user[key]
    }
  }
  return formattedUser
}

async function getUserFeatures(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  if (!userId) {
    throw new Error('User is not logged in')
  }
  const features = await UserGetter.promises.getUserFeatures(userId)
  return res.json(features)
}

export default {
  getLoggedInUsersPersonalInfo,
  getPersonalInfo,
  sendFormattedPersonalInfo,
  formatPersonalInfo,
  getUserFeatures: expressify(getUserFeatures),
}
