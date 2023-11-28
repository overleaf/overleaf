const express = require('express')
const bodyParser = require('body-parser')

class TestServer {
  constructor(port) {
    this.app = express()

    this.app.use(bodyParser.json())
    this.app.use((req, res, next) => {
      this.lastReq = req
      next()
    })

    // Plain text endpoints

    this.app.get('/hello', (req, res) => {
      res.send('hello')
    })

    this.largePayload = 'x'.repeat(16 * 1024 * 1024)
    this.app.get('/large', (req, res) => {
      res.send(this.largePayload)
    })

    this.app.get('/204', (req, res) => {
      res.status(204).end()
    })

    this.app.get('/empty', (req, res) => {
      res.end()
    })

    this.app.get('/500', (req, res) => {
      res.sendStatus(500)
    })

    this.app.post('/sink', (req, res) => {
      req.on('data', () => {})
      req.on('end', () => {
        res.status(204).end()
      })
    })

    // JSON endpoints

    this.app.get('/json/hello', (req, res) => {
      res.json({ msg: 'hello' })
    })

    this.app.post('/json/add', (req, res) => {
      const { a, b } = req.body
      res.json({ sum: a + b })
    })

    this.app.get('/json/500', (req, res) => {
      res.status(500).json({ error: 'Internal server error' })
    })

    this.app.get('/json/basic-auth', (req, res) => {
      const expectedAuth =
        'Basic ' + Buffer.from('user:pass').toString('base64')
      if (req.headers.authorization === expectedAuth) {
        res.json({ key: 'verysecret' })
      } else {
        res.status(401).json({ error: 'unauthorized' })
      }
    })

    this.app.post('/json/ignore-request', (req, res) => {
      res.json({ msg: 'hello' })
    })

    // Never returns

    this.app.post('/hang', (req, res) => {})

    // Redirect

    this.app.get('/redirect/1', (req, res) => {
      res.redirect('/redirect/2')
    })
    this.app.get('/redirect/2', (req, res) => {
      res.send('body after redirect')
    })
    this.app.get('/redirect/empty-location', (req, res) => {
      res.sendStatus(302)
    })
  }

  start(port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(port, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  stop() {
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

module.exports = { TestServer }
