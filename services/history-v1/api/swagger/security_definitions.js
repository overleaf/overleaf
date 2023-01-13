'use strict'

module.exports = {
  jwt: {
    type: 'apiKey',
    in: 'header',
    name: 'authorization',
  },
  basic: {
    type: 'basic',
  },
  token: {
    type: 'apiKey',
    in: 'query',
    name: 'token',
  },
}
