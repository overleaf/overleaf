/* eslint-disable
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Client
const { XMLHttpRequest } = require('../../libs/XMLHttpRequest')
const io = require('socket.io-client')
const async = require('async')

const request = require('request')
const Settings = require('@overleaf/settings')
const redis = require('@overleaf/redis-wrapper')
const rclient = redis.createClient(Settings.redis.websessions)

const uid = require('uid-safe').sync
const signature = require('cookie-signature')

io.util.request = function () {
  const xhr = new XMLHttpRequest()
  const _open = xhr.open
  xhr.open = function () {
    _open.apply(xhr, arguments)
    if (Client.cookie != null) {
      return xhr.setRequestHeader('Cookie', Client.cookie)
    }
  }
  return xhr
}

module.exports = Client = {
  cookie: null,

  setSession(session, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const sessionId = uid(24)
    session.cookie = {}
    return rclient.set('sess:' + sessionId, JSON.stringify(session), error => {
      if (error != null) {
        return callback(error)
      }
      const secret = Settings.security.sessionSecret
      const cookieKey = 's:' + signature.sign(sessionId, secret)
      Client.cookie = `${Settings.cookieName}=${cookieKey}`
      return callback()
    })
  },

  unsetSession(callback) {
    if (callback == null) {
      callback = function () {}
    }
    Client.cookie = null
    return callback()
  },

  connect(cookie) {
    const client = io.connect('http://localhost:3026', {
      'force new connection': true,
    })
    client.on(
      'connectionAccepted',
      (_, publicId) => (client.publicId = publicId)
    )
    return client
  },

  getConnectedClients(callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: 'http://localhost:3026/clients',
        json: true,
      },
      (error, response, data) => callback(error, data)
    )
  },

  getConnectedClient(clientId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `http://localhost:3026/clients/${clientId}`,
        json: true,
      },
      (error, response, data) => callback(error, data)
    )
  },

  disconnectClient(clientId, callback) {
    request.post(
      {
        url: `http://localhost:3026/client/${clientId}/disconnect`,
      },
      (error, response, data) => callback(error, data)
    )
    return null
  },

  disconnectAllClients(callback) {
    return Client.getConnectedClients((error, clients) => {
      if (error) return callback(error)
      async.each(
        clients,
        (clientView, cb) => Client.disconnectClient(clientView.client_id, cb),
        callback
      )
    })
  },
}
