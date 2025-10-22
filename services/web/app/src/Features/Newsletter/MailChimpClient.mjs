import { fetchJson, fetchNothing } from '@overleaf/fetch-utils'

class MailChimpClient {
  constructor(apiKey) {
    this.apiKey = apiKey
    this.dc = apiKey.split('-')[1]
    this.baseUrl = `https://${this.dc}.api.mailchimp.com/3.0/`
    this.fetchOptions = {
      method: 'GET',
      basicAuth: {
        user: 'any',
        password: this.apiKey,
      },
    }
  }

  async request(path, options) {
    try {
      const requestUrl = `${this.baseUrl}${path}`
      if (options.method === 'GET') {
        return await fetchJson(requestUrl, options)
      }
      await fetchNothing(requestUrl, options)
    } catch (err) {
      // if there's a json body in the response, expose it in the error (for compatibility with node-mailchimp)
      const errorBody = err.body ? JSON.parse(err.body) : {}
      const errWithBody = Object.assign(err, errorBody)
      throw errWithBody
    }
  }

  async get(path) {
    return await this.request(path, this.fetchOptions)
  }

  async put(path, body) {
    const options = Object.assign({}, this.fetchOptions)
    options.method = 'PUT'
    options.json = body

    return await this.request(path, options)
  }

  async post(path, body) {
    const options = Object.assign({}, this.fetchOptions)
    options.method = 'POST'
    options.json = body

    return await this.request(path, options)
  }

  async delete(path) {
    const options = Object.assign({}, this.fetchOptions)
    options.method = 'DELETE'

    return await this.request(path, options)
  }

  async patch(path, body) {
    const options = Object.assign({}, this.fetchOptions)
    options.method = 'PATCH'
    options.json = body

    return await this.request(path, options)
  }
}

export default MailChimpClient
