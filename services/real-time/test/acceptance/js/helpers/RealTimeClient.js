import io from 'socket.io-client'

import Settings from '@overleaf/settings'
import redis from '@overleaf/redis-wrapper'

import uidSafe from 'uid-safe'
import signature from 'cookie-signature'
import { callbackify } from 'node:util'
import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'
import { XMLHttpRequest } from '../../libs/XMLHttpRequest.js'

const rclient = redis.createClient(Settings.redis.websessions)
const uid = uidSafe.sync

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

async function setSession(session) {
  const sessionId = uid(24)
  session.cookie = {}

  await rclient.set('sess:' + sessionId, JSON.stringify(session))

  Client.cookieSignedWith = {}
  // prepare cookie strings for all supported session secrets
  for (const secretName of [
    'sessionSecret',
    'sessionSecretFallback',
    'sessionSecretUpcoming',
  ]) {
    const secret = Settings.security[secretName]
    const cookieKey = 's:' + signature.sign(sessionId, secret)
    Client.cookieSignedWith[secretName] = `${Settings.cookieName}=${cookieKey}`
  }
  // default to the current session secret
  Client.cookie = Client.cookieSignedWith.sessionSecret
}

async function setAnonSession(projectId, anonymousAccessToken) {
  await Client.promises.setSession({
    anonTokenAccess: {
      [projectId]: anonymousAccessToken,
    },
  })
}

function connect(projectId) {
  const client = io.connect('http://127.0.0.1:3026', {
    'force new connection': true,
    query: new URLSearchParams({ projectId }).toString(),
  })
  let disconnected = false
  client.on('disconnect', () => {
    disconnected = true
  })
  const promise = new Promise((resolve, reject) => {
    client.on('connectionRejected', err => {
      // Wait for disconnect ahead of continuing with the test sequence.
      setTimeout(() => {
        if (!disconnected) {
          throw new Error('should disconnect after connectionRejected')
        }
        reject(err)
      }, 10)
    })

    client.on('joinProjectResponse', resp => {
      const { publicId, project, permissionsLevel, protocolVersion } = resp
      client.publicId = publicId
      resolve({ project, permissionsLevel, protocolVersion, client })
    })
  })
  return { client, promise }
}

async function getConnectedClients() {
  return await fetchJson('http://127.0.0.1:3026/clients')
}

async function countConnectedClients(projectId) {
  return await fetchJson(
    `http://127.0.0.1:3026/project/${projectId}/count-connected-clients`
  )
}

async function getConnectedClient(clientId) {
  try {
    return await fetchJson(`http://127.0.0.1:3026/clients/${clientId}`)
  } catch (err) {
    if (err.info?.status === 404) throw new Error('not found')
    throw err
  }
}

async function disconnectClient(clientId) {
  await fetchNothing(`http://127.0.0.1:3026/client/${clientId}/disconnect`, {
    method: 'POST',
  })
}

async function disconnectAllClients() {
  const clients = await Client.promises.getConnectedClients()
  await Promise.all(
    clients.map(clientView =>
      Client.promises.disconnectClient(clientView.client_id)
    )
  )
}

const Client = {
  cookie: null,
  setSession: callbackify(setSession),
  setAnonSession: callbackify(setAnonSession),
  connect: (projectId, callback) => {
    const { client, promise } = connect(projectId)
    if (callback) {
      promise
        .then(({ project, permissionsLevel, protocolVersion }) =>
          callback(null, project, permissionsLevel, protocolVersion)
        )
        .catch(err => callback(err))
    }
    return client
  },
  getConnectedClients: callbackify(getConnectedClients),
  countConnectedClients: callbackify(countConnectedClients),
  getConnectedClient: callbackify(getConnectedClient),
  disconnectClient: callbackify(disconnectClient),
  disconnectAllClients: callbackify(disconnectAllClients),
  promises: {
    setSession,
    setAnonSession,
    connect: async projectId => {
      const { client, promise } = connect(projectId)
      const { project, permissionsLevel, protocolVersion } = await promise
      return { project, permissionsLevel, protocolVersion, client }
    },
    getConnectedClients,
    countConnectedClients,
    getConnectedClient,
    disconnectClient,
    disconnectAllClients,
  },
}

export default Client
