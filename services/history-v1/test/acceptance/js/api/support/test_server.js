/**
 * @file
 * Create a test server. For performance reasons, there is only one test server,
 * and it is shared between all of the tests.
 *
 * This uses the mocha's "root-level hooks" to start and clean up the server.
 */

const BPromise = require('bluebird')
const config = require('config')
const http = require('node:http')
const jwt = require('jsonwebtoken')

const Swagger = require('swagger-client')

const app = require('../../../../../app')

function testUrl(pathname, opts = {}) {
  const url = new URL('http://127.0.0.1')
  url.port = exports.server.address().port
  url.pathname = pathname
  if (opts.qs) {
    url.searchParams = new URLSearchParams(opts.qs)
  }
  return url.toString()
}

exports.url = testUrl

function createClient(options) {
  // The Swagger client returns native Promises; we use Bluebird promises. Just
  // wrapping the client creation is enough in many (but not all) cases to
  // get Bluebird into the chain.
  return BPromise.resolve(new Swagger(testUrl('/api-docs'), options))
}

function createTokenForProject(projectId, opts = {}) {
  const jwtKey = opts.jwtKey || config.get('jwtAuth.key')
  const jwtAlgorithm = config.get('jwtAuth.algorithm')
  return jwt.sign({ project_id: projectId }, jwtKey, {
    algorithm: jwtAlgorithm,
  })
}

exports.createTokenForProject = createTokenForProject

function createClientForProject(projectId, opts = {}) {
  const token = createTokenForProject(projectId, opts)
  return createClient({ authorizations: { jwt: `Bearer ${token}` } })
}

exports.createClientForProject = createClientForProject

function createClientForDownloadZip(projectId) {
  const token = createTokenForProject(projectId)
  return createClient({ authorizations: { token } })
}

exports.createClientForDownloadZip = createClientForDownloadZip

function createBasicAuthClient() {
  return createClient({
    authorizations: {
      basic: {
        username: 'staging',
        password: config.get('basicHttpAuth.password'),
      },
    },
  })
}

function createPseudoJwtBasicAuthClient() {
  // HACK: The history service will accept HTTP basic auth for any endpoint that
  // is expecting a JWT. If / when we fix that, we will need to fix this.
  const jwt =
    'Basic ' +
    Buffer.from(`staging:${config.get('basicHttpAuth.password')}`).toString(
      'base64'
    )
  return createClient({ authorizations: { jwt } })
}

exports.basicAuthHeader =
  'Basic ' +
  Buffer.from(`staging:${config.get('basicHttpAuth.password')}`).toString(
    'base64'
  )

function createServer() {
  const server = http.createServer(app)
  return app.setup().then(() => {
    exports.server = server
    return server
  })
}

function createDefaultUnauthenticatedClient() {
  return createClient().then(client => {
    exports.client = client
  })
}

function createDefaultBasicAuthClient() {
  return createBasicAuthClient().then(client => {
    exports.basicAuthClient = client
  })
}

function createDefaultPseudoJwtBasicAuthClient() {
  return createPseudoJwtBasicAuthClient().then(client => {
    exports.pseudoJwtBasicAuthClient = client
  })
}

before(function () {
  function listenOnRandomPort(server) {
    const listen = BPromise.promisify(server.listen, { context: server })
    return listen(0).catch(err => {
      if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') throw err
      return listenOnRandomPort(server)
    })
  }

  return createServer()
    .then(listenOnRandomPort)
    .then(createDefaultUnauthenticatedClient)
    .then(createDefaultBasicAuthClient)
    .then(createDefaultPseudoJwtBasicAuthClient)
})

after(function () {
  exports.server.close()
})
