/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Client
const request = require('request')
const fs = require('fs')
const Settings = require('@overleaf/settings')

const host = 'localhost'

module.exports = Client = {
  host: Settings.apis.clsi.url,

  randomId() {
    return Math.random().toString(16).slice(2)
  },

  compile(projectId, data, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (data) {
      // Enable pdf caching unless disabled explicitly.
      data.options = Object.assign({}, { enablePdfCaching: true }, data.options)
    }
    return request.post(
      {
        url: `${this.host}/project/${projectId}/compile`,
        json: {
          compile: data,
        },
      },
      callback
    )
  },

  clearCache(projectId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.del(`${this.host}/project/${projectId}`, callback)
  },

  getOutputFile(response, type) {
    for (const file of Array.from(response.compile.outputFiles)) {
      if (file.type === type && file.url.match(`output.${type}`)) {
        return file
      }
    }
    return null
  },

  runServer(port, directory) {
    const express = require('express')
    const app = express()
    app.use(express.static(directory))
    console.log('starting test server on', port, host)
    return app.listen(port, host).on('error', error => {
      console.error('error starting server:', error.message)
      return process.exit(1)
    })
  },

  syncFromCode(projectId, file, line, column, callback) {
    Client.syncFromCodeWithImage(projectId, file, line, column, '', callback)
  },

  syncFromCodeWithImage(projectId, file, line, column, imageName, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${this.host}/project/${projectId}/sync/code`,
        qs: {
          imageName,
          file,
          line,
          column,
        },
        json: true,
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(new Error(`statusCode=${response.statusCode}`), body)
        }
        return callback(null, body)
      }
    )
  },

  syncFromPdf(projectId, page, h, v, callback) {
    Client.syncFromPdfWithImage(projectId, page, h, v, '', callback)
  },

  syncFromPdfWithImage(projectId, page, h, v, imageName, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${this.host}/project/${projectId}/sync/pdf`,
        qs: {
          imageName,
          page,
          h,
          v,
        },
        json: true,
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(new Error(`statusCode=${response.statusCode}`), body)
        }
        return callback(null, body)
      }
    )
  },

  compileDirectory(projectId, baseDirectory, directory, serverPort, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const resources = []
    let entities = fs.readdirSync(`${baseDirectory}/${directory}`)
    let rootResourcePath = 'main.tex'
    while (entities.length > 0) {
      const entity = entities.pop()
      const stat = fs.statSync(`${baseDirectory}/${directory}/${entity}`)
      if (stat.isDirectory()) {
        entities = entities.concat(
          fs
            .readdirSync(`${baseDirectory}/${directory}/${entity}`)
            .map(subEntity => {
              if (subEntity === 'main.tex') {
                rootResourcePath = `${entity}/${subEntity}`
              }
              return `${entity}/${subEntity}`
            })
        )
      } else if (stat.isFile() && entity !== 'output.pdf') {
        const extension = entity.split('.').pop()
        if (
          [
            'tex',
            'bib',
            'cls',
            'sty',
            'pdf_tex',
            'Rtex',
            'ist',
            'md',
            'Rmd',
          ].indexOf(extension) > -1
        ) {
          resources.push({
            path: entity,
            content: fs
              .readFileSync(`${baseDirectory}/${directory}/${entity}`)
              .toString(),
          })
        } else if (
          ['eps', 'ttf', 'png', 'jpg', 'pdf', 'jpeg'].indexOf(extension) > -1
        ) {
          resources.push({
            path: entity,
            url: `http://${host}:${serverPort}/${directory}/${entity}`,
            modified: stat.mtime,
          })
        }
      }
    }

    return fs.readFile(
      `${baseDirectory}/${directory}/options.json`,
      (error, body) => {
        const req = {
          resources,
          rootResourcePath,
        }

        if (error == null) {
          body = JSON.parse(body)
          req.options = body
        }

        return this.compile(projectId, req, callback)
      }
    )
  },

  wordcount(projectId, file, callback) {
    const image = undefined
    Client.wordcountWithImage(projectId, file, image, callback)
  },

  wordcountWithImage(projectId, file, image, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return request.get(
      {
        url: `${this.host}/project/${projectId}/wordcount`,
        qs: {
          image,
          file,
        },
      },
      (error, response, body) => {
        if (error != null) {
          return callback(error)
        }
        if (response.statusCode !== 200) {
          return callback(new Error(`statusCode=${response.statusCode}`), body)
        }
        return callback(null, JSON.parse(body))
      }
    )
  },
}
