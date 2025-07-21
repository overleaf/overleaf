import express from 'express'

class MockFilestore {
  constructor() {
    this.host = process.env.FILESTORE_HOST || '127.0.0.1'
    this.port = process.env.FILESTORE_PORT || 3009
    // create a server listening on this.host and this.port
    this.files = {}

    this.app = express()

    this.app.get('/project/:projectId/file/:fileId', (req, res) => {
      const { projectId, fileId } = req.params
      const content = this.files[projectId]?.[fileId]
      if (!content) return res.status(404).end()
      res.status(200).end(content)
    })
  }

  start() {
    // reset stored files
    this.files = {}
    // start the server
    if (this.serverPromise) {
      return this.serverPromise
    } else {
      this.serverPromise = new Promise((resolve, reject) => {
        this.server = this.app.listen(this.port, this.host, err => {
          if (err) return reject(err)
          resolve()
        })
      })
      return this.serverPromise
    }
  }

  addFile(projectId, fileId, fileContent) {
    if (!this.files[projectId]) {
      this.files[projectId] = {}
    }
    this.files[projectId][fileId] = fileContent
  }

  deleteObject(projectId, fileId) {
    if (this.files[projectId]) {
      delete this.files[projectId][fileId]
      if (Object.keys(this.files[projectId]).length === 0) {
        delete this.files[projectId]
      }
    }
  }
}

export const mockFilestore = new MockFilestore()
