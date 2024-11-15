'use strict'

const basicAuth = require('basic-auth')
const config = require('config')
const HTTPStatus = require('http-status')
const jwt = require('jsonwebtoken')
const tsscmp = require('tsscmp')

function setupBasicHttpAuthForSwaggerDocs(app) {
  app.use('/docs', function (req, res, next) {
    if (hasValidBasicAuthCredentials(req)) {
      return next()
    }

    res.header('WWW-Authenticate', 'Basic realm="Application"')
    res.status(HTTPStatus.UNAUTHORIZED).end()
  })
}

exports.setupBasicHttpAuthForSwaggerDocs = setupBasicHttpAuthForSwaggerDocs

function hasValidBasicAuthCredentials(req) {
  const credentials = basicAuth(req)
  if (!credentials) return false

  // No security in the name, so just use straight comparison.
  if (credentials.name !== 'staging') return false

  const password = config.get('basicHttpAuth.password')
  if (password && tsscmp(credentials.pass, password)) return true

  // Support an old password so we can change the password without downtime.
  if (config.has('basicHttpAuth.oldPassword')) {
    const oldPassword = config.get('basicHttpAuth.oldPassword')
    if (oldPassword && tsscmp(credentials.pass, oldPassword)) return true
  }

  return false
}

function setupSSL(app) {
  const httpsOnly = config.get('httpsOnly') === 'true'
  if (!httpsOnly) {
    return
  }
  app.enable('trust proxy')
  app.use(function (req, res, next) {
    if (req.protocol === 'https') {
      next()
      return
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      res.redirect('https://' + req.headers.host + req.url)
    } else {
      res
        .status(HTTPStatus.FORBIDDEN)
        .send('Please use HTTPS when submitting data to this server.')
    }
  })
}

exports.setupSSL = setupSSL

function handleJWTAuth(req, authOrSecDef, scopesOrApiKey, next) {
  // as a temporary solution, to make the OT demo still work
  // this handler will also check for basic authorization
  if (hasValidBasicAuthCredentials(req)) {
    return next()
  }
  let token, err
  if (authOrSecDef.name === 'token') {
    token = req.query.token
  } else if (
    req.headers.authorization &&
    req.headers.authorization.split(' ')[0] === 'Bearer'
  ) {
    token = req.headers.authorization.split(' ')[1]
  }
  if (!token) {
    err = new Error('jwt missing')
    err.statusCode = HTTPStatus.UNAUTHORIZED
    err.headers = { 'WWW-Authenticate': 'Bearer' }
    return next(err)
  }
  let decoded
  try {
    decoded = decodeJWT(token)
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      err = new Error(error.message)
      err.statusCode = HTTPStatus.UNAUTHORIZED
      err.headers = { 'WWW-Authenticate': 'Bearer error="invalid_token"' }
      return next(err)
    }
    throw error
  }
  if (decoded.project_id.toString() !== req.swagger.params.project_id.value) {
    err = new Error('Wrong project_id')
    err.statusCode = HTTPStatus.FORBIDDEN
    return next(err)
  }
  next()
}

exports.hasValidBasicAuthCredentials = hasValidBasicAuthCredentials

/**
 * Verify and decode the given JSON Web Token
 */
function decodeJWT(token) {
  const key = config.get('jwtAuth.key')
  const algorithm = config.get('jwtAuth.algorithm')
  try {
    return jwt.verify(token, key, { algorithms: [algorithm] })
  } catch (err) {
    // Support an old key so we can change the key without downtime.
    if (config.has('jwtAuth.oldKey')) {
      const oldKey = config.get('jwtAuth.oldKey')
      return jwt.verify(token, oldKey, { algorithms: [algorithm] })
    } else {
      throw err
    }
  }
}
function handleBasicAuth(req, authOrSecDef, scopesOrApiKey, next) {
  if (hasValidBasicAuthCredentials(req)) {
    return next()
  }
  const error = new Error()
  error.statusCode = HTTPStatus.UNAUTHORIZED
  error.headers = { 'WWW-Authenticate': 'Basic realm="Application"' }
  return next(error)
}

function getSwaggerHandlers() {
  const handlers = {}
  if (!config.has('jwtAuth.key') || !config.has('basicHttpAuth.password')) {
    throw new Error('missing authentication env vars')
  }
  handlers.jwt = handleJWTAuth
  handlers.basic = handleBasicAuth
  handlers.token = handleJWTAuth
  return handlers
}

exports.getSwaggerHandlers = getSwaggerHandlers
