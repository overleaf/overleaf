'use strict'

const nodeFetch = require('node-fetch')
const {
  fetchJsonWithResponse,
  fetchStreamWithResponse,
  RequestFailedError,
} = require('@overleaf/fetch-utils')

/**
 * Create an HTTP client that mimics the swagger-client API
 * @param {string} baseUrl - Base URL for the API
 * @param {Object} options - Options including authorizations
 * @returns {Object} Client with apis.Project and apis.ProjectImport methods
 */
function createHttpClient(baseUrl, options = {}) {
  const authHeaders = {}
  const queryParams = {}

  // Handle different auth types
  if (options.authorizations) {
    if (options.authorizations.jwt) {
      if (options.authorizations.jwt.startsWith('Bearer ')) {
        authHeaders.Authorization = options.authorizations.jwt
      } else if (options.authorizations.jwt.startsWith('Basic ')) {
        authHeaders.Authorization = options.authorizations.jwt
      } else {
        authHeaders.Authorization = `Bearer ${options.authorizations.jwt}`
      }
    }
    if (options.authorizations.basic) {
      const { username, password } = options.authorizations.basic
      const credentials = Buffer.from(`${username}:${password}`).toString(
        'base64'
      )
      authHeaders.Authorization = `Basic ${credentials}`
    }
    if (options.authorizations.token) {
      queryParams.token = options.authorizations.token
    }
  }

  function makeRequest(method, path, params = {}) {
    // Build URL with path params
    // Ensure we don't have double slashes between baseUrl and path
    const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
    const pathStart = path.startsWith('/') ? path : `/${path}`
    let url = `${base}${pathStart}`
    Object.keys(params).forEach(key => {
      if (
        key !== 'body' &&
        key !== 'since' &&
        key !== 'end_version' &&
        key !== 'return_snapshot' &&
        key !== 'snapshot' &&
        key !== 'changes'
      ) {
        const value = params[key]
        if (value !== undefined && value !== null) {
          url = url.replace(`:${key}`, String(value))
        }
      }
    })

    // Build query string
    const query = new URLSearchParams()
    if (params.since !== undefined) {
      query.append('since', params.since)
    }
    if (params.end_version !== undefined) {
      query.append('end_version', params.end_version)
    }
    if (params.return_snapshot) {
      query.append('return_snapshot', params.return_snapshot)
    }
    Object.keys(queryParams).forEach(key => {
      query.append(key, queryParams[key])
    })
    if (query.toString()) {
      url += `?${query.toString()}`
    }

    // Build headers
    const headers = { ...authHeaders }
    let body = null

    if (params.body) {
      body = JSON.stringify(params.body)
      headers['Content-Type'] = 'application/json'
    } else if (method === 'POST' || method === 'PUT') {
      // Some endpoints have the entire body as the parameter
      if (params.snapshot !== undefined) {
        body = JSON.stringify(params.snapshot)
        headers['Content-Type'] = 'application/json'
      } else if (params.changes !== undefined) {
        body = JSON.stringify(params.changes)
        headers['Content-Type'] = 'application/json'
      }
    }

    const fetchOpts = {
      method,
      headers,
      body,
    }

    const isNoContentEndpoint =
      (method === 'POST' && url.includes('/flush')) ||
      (method === 'POST' && url.includes('/expire')) ||
      (method === 'DELETE' &&
        url.includes('/api/projects/') &&
        !url.includes('/blobs/'))

    const isBlobEndpoint =
      method === 'GET' && (url.includes('/blobs/') || url.includes('/zip'))

    if (isNoContentEndpoint) {
      return nodeFetch(url, fetchOpts).then(response => {
        const headersObj = {}
        response.headers.forEach((value, key) => {
          headersObj[key.toLowerCase()] = value
        })

        return {
          obj: null,
          body: null,
          status: response.status,
          headers: headersObj,
          ok: response.ok,
        }
      })
    }

    if (isBlobEndpoint) {
      return fetchStreamWithResponse(url, fetchOpts)
        .then(({ stream, response }) => {
          const headersObj = {}
          response.headers.forEach((value, key) => {
            headersObj[key.toLowerCase()] = value
          })

          let cachedBuffer = null
          const bufferPromise = (async () => {
            if (cachedBuffer === null) {
              const chunks = []
              for await (const chunk of stream) {
                chunks.push(chunk)
              }
              cachedBuffer = Buffer.concat(chunks)
            }
            return cachedBuffer
          })()

          return {
            obj: null,
            status: response.status,
            headers: headersObj,
            data: {
              text: async () => {
                const buffer = await bufferPromise
                return buffer.toString()
              },
              json: async () => {
                const buffer = await bufferPromise
                return JSON.parse(buffer.toString())
              },
              arrayBuffer: async () => {
                const buffer = await bufferPromise
                return Uint8Array.from(buffer).buffer
              },
            },
            ok: response.ok,
          }
        })
        .catch(err => {
          if (err instanceof RequestFailedError) {
            // Convert Headers object to plain object for compatibility with tests
            const headersObj = {}
            err.response.headers.forEach((value, key) => {
              headersObj[key.toLowerCase()] = value
            })

            // Use the server's error message if available, otherwise use the generic message
            let errorMessage = err.message
            let errorObj = err.body

            if (err.body) {
              try {
                const bodyObj =
                  typeof err.body === 'string' ? JSON.parse(err.body) : err.body
                errorObj = bodyObj // Store parsed object for error.obj
                if (bodyObj?.message) {
                  errorMessage = bodyObj.message
                } else if (typeof bodyObj === 'string' && bodyObj.trim()) {
                  errorMessage = bodyObj
                }
              } catch (e) {
                // If body isn't JSON, use the string as-is or fall back to generic message
                if (typeof err.body === 'string' && err.body.trim()) {
                  errorMessage = err.body
                  errorObj = err.body
                }
              }
            }

            // If we still have the generic message, include status code for better debugging
            if (errorMessage === 'request failed' && err.response?.status) {
              errorMessage = `request failed with status ${err.response.status}`
            }

            const error = new Error(errorMessage)
            error.status = err.response.status
            error.statusCode = err.response.status
            error.obj = errorObj
            error.response = {
              status: err.response.status,
              statusCode: err.response.status,
              headers: headersObj, // Plain object for err.response.headers access
              ok: err.response.ok,
            }
            throw error
          }
          throw err
        })
    }

    // For JSON endpoints, use fetchJsonWithResponse but handle errors ourselves
    return fetchJsonWithResponse(url, fetchOpts)
      .then(({ json, response }) => {
        // Convert Headers object to plain object for compatibility
        const headersObj = {}
        response.headers.forEach((value, key) => {
          headersObj[key.toLowerCase()] = value
        })

        return {
          obj: json,
          body: json,
          status: response.status,
          headers: headersObj, // Plain object for compatibility
          ok: response.ok,
        }
      })
      .catch(err => {
        if (err instanceof RequestFailedError) {
          // Convert Headers object to plain object for compatibility with tests
          const headersObj = {}
          err.response.headers.forEach((value, key) => {
            headersObj[key.toLowerCase()] = value
          })

          // Preserve the response object structure that tests expect
          let errorMessage = err.message
          let errorObj = err.body

          // If we still have the generic message, include status code for better debugging
          if (errorMessage === 'request failed' && err.response?.status) {
            errorMessage = `request failed with status ${err.response.status}`
          }

          if (typeof errorObj === 'string') {
            try {
              errorObj = JSON.parse(errorObj)
            } catch (e) {
              // leave it as string if it isn't JSON
            }
          }

          const status = err.response.status

          const error = new Error(errorMessage)
          error.status = status
          error.statusCode = status
          error.obj = errorObj
          error.response = {
            status,
            statusCode: status,
            headers: headersObj, // Plain object for err.response.headers['www-authenticate'] access
            ok: err.response.ok,
            body: errorObj,
          }
          throw error
        }

        // Handle invalid JSON responses (e.g. empty body with 200/204)
        if (
          err?.name === 'FetchError' &&
          (err?.type === 'invalid-json' ||
            (typeof err.message === 'string' &&
              err.message.indexOf('invalid json response body') !== -1))
        ) {
          const response = err.response
          if (response) {
            const headersObj = {}
            response.headers.forEach((value, key) => {
              headersObj[key.toLowerCase()] = value
            })
            if (!response.ok) {
              const error = new Error(
                `request failed with status ${response.status}`
              )
              error.status = response.status
              error.statusCode = response.status
              error.obj = null
              error.response = {
                status: response.status,
                statusCode: response.status,
                headers: headersObj,
                ok: response.ok,
              }
              throw error
            }
            return {
              obj: null,
              body: null,
              status: response.status,
              headers: headersObj,
              ok: response.ok,
            }
          }
        }

        throw err
      })
  }

  return {
    apis: {
      Project: {
        initializeProject: params =>
          makeRequest('POST', '/api/projects', params),
        getProjectBlobsStats: params =>
          makeRequest('POST', '/api/projects/blob-stats', params),
        getBlobStats: params =>
          makeRequest('POST', `/api/projects/:project_id/blob-stats`, params),
        deleteProject: params =>
          makeRequest('DELETE', `/api/projects/:project_id`, params),
        getProjectBlob: params =>
          makeRequest('GET', `/api/projects/:project_id/blobs/:hash`, params),
        headProjectBlob: params =>
          makeRequest('HEAD', `/api/projects/:project_id/blobs/:hash`, params),
        createProjectBlob: params =>
          makeRequest('PUT', `/api/projects/:project_id/blobs/:hash`, params),
        copyProjectBlob: params =>
          makeRequest('POST', `/api/projects/:project_id/blobs/:hash`, params),
        getLatestContent: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/latest/content`,
            params
          ),
        getLatestHashedContent: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/latest/hashed_content`,
            params
          ),
        getLatestHistory: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/latest/history`,
            params
          ),
        getLatestHistoryRaw: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/latest/history/raw`,
            params
          ),
        getLatestPersistedHistory: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/latest/persistedHistory`,
            params
          ),
        getHistory: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/versions/:version/history`,
            params
          ),
        getContentAtVersion: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/versions/:version/content`,
            params
          ),
        getHistoryBefore: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/timestamp/:timestamp/history`,
            params
          ),
        getZip: params =>
          makeRequest(
            'GET',
            `/api/projects/:project_id/version/:version/zip`,
            params
          ),
        createZip: params =>
          makeRequest(
            'POST',
            `/api/projects/:project_id/version/:version/zip`,
            params
          ),
        getChanges: params =>
          makeRequest('GET', `/api/projects/:project_id/changes`, params),
      },
      ProjectImport: {
        importSnapshot1: params =>
          makeRequest('POST', `/api/projects/:project_id/import`, params),
        importChanges1: params =>
          makeRequest('POST', `/api/projects/:project_id/changes`, params),
        flushChanges: params =>
          makeRequest('POST', `/api/projects/:project_id/flush`, params),
        expireProject: params =>
          makeRequest('POST', `/api/projects/:project_id/expire`, params),
      },
    },
  }
}

module.exports = createHttpClient
