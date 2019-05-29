/* eslint-disable
    camelcase,
    max-len,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let sixpack
const settings = require('settings-sharelatex')
const request = require('request')
const logger = require('logger-sharelatex')

const timeout = process.env.NODE_ENV === 'production' ? 500 : 5000
logger.log(`using timeout of ${timeout}ms for sixpack server calls`)

const generate_client_id = () =>
  // from http://stackoverflow.com/questions/105034
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })

const _request_uri = function(endpoint, params) {
  const query_string = []
  const e = encodeURIComponent
  for (let key in params) {
    if (params.hasOwnProperty(key)) {
      let vals = params[key]
      if (Object.prototype.toString.call(vals) !== '[object Array]') {
        vals = [vals]
      }
      let i = 0
      while (i < vals.length) {
        query_string.push(e(key) + '=' + e(vals[i]))
        i += 1
      }
    }
  }
  if (query_string.length) {
    endpoint += `?${query_string.join('&')}`
  }
  return endpoint
}

const _request = function(uri, params, callback) {
  const opts = {
    uri: _request_uri(uri, params),
    json: true,
    timeout
  }
  return request.get(opts, (err, res, body) => callback(err, body))
}

module.exports = sixpack = {
  client(user_id) {
    const client = new sixpack.Session(user_id, settings.apis.sixpack.url)
    return client
  },

  Session(client_id, base_url, ip_address, user_agent) {
    this.client_id = client_id || sixpack.generate_client_id()
    this.base_url = base_url || sixpack.base_url

    return {
      participate: (experiment_name, alternatives, force, callback) => {
        if (typeof force === 'function') {
          callback = force
          force = null
        }
        if (!/^[a-z0-9][a-z0-9\-_ ]*$/.test(experiment_name)) {
          return callback(new Error('Bad experiment_name'))
        }
        if (alternatives.length < 2) {
          return callback(new Error('Must specify at least 2 alternatives'))
        }
        let i = 0
        while (i < alternatives.length) {
          if (!/^[a-z0-9][a-z0-9\-_ ]*$/.test(alternatives[i])) {
            return callback(
              new Error(`Bad alternative name: ${alternatives[i]}`)
            )
          }
          i += 1
        }
        const params = {
          client_id: this.client_id,
          experiment: experiment_name,
          alternatives
        }

        if (force !== null && _in_array(alternatives, force)) {
          return callback(null, {
            status: 'ok',
            alternative: {
              name: force
            },
            experiment: {
              version: 0,
              name: experiment_name
            },
            client_id: this.client_id
          })
        }

        return _request(this.base_url + '/participate', params, function(
          err,
          res
        ) {
          if (err != null) {
            res = {
              status: 'failed',
              error: err,
              alternative: {
                name: alternatives[0]
              }
            }
          }
          return callback(null, res)
        })
      },

      convert: (experiment_name, callback) => {
        if (!/^[a-z0-9][a-z0-9\-_ ]*$/.test(experiment_name)) {
          return callback(new Error('Bad experiment_name'))
        }
        const params = {
          client_id: this.client_id,
          experiment: experiment_name
        }
        if (this.ip_address) {
          params.ip_address = this.ip_address
        }
        if (this.user_agent) {
          params.user_agent = this.user_agent
        }
        return _request(this.base_url + '/convert', params, function(err, res) {
          if (err != null) {
            res = {
              status: 'failed',
              error: err
            }
          }
          return callback(null, res)
        })
      }
    }
  }
}
