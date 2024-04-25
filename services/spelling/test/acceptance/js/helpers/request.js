import { promisify } from 'util'
import Request from 'request'

export const PORT = 3005

const BASE_URL = `http://${process.env.HTTP_TEST_HOST || '127.0.0.1'}:${PORT}`

const request = Request.defaults({
  baseUrl: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  followRedirect: false,
})

export const get = promisify(request.get)
export const post = promisify(request.post)
export const del = promisify(request.del)
