const express = require('express')
const {
  fetchJson,
  fetchNothing,
  fetchString,
} = require('@overleaf/fetch-utils')
const fs = require('node:fs')
const fsPromises = require('node:fs/promises')
const Settings = require('@overleaf/settings')

const host = Settings.apis.clsi.url

function randomId() {
  return Math.random().toString(16).slice(2)
}

function compile(projectId, data) {
  if (data) {
    // Enable pdf caching unless disabled explicitly.
    data.options = Object.assign({}, { enablePdfCaching: true }, data.options)
  }
  return fetchJson(`${host}/project/${projectId}/compile`, {
    method: 'POST',
    json: {
      compile: data,
    },
  })
}

async function stopCompile(projectId) {
  return await fetchNothing(`${host}/project/${projectId}/compile/stop`, {
    method: 'POST',
  })
}

async function clearCache(projectId) {
  await fetchNothing(`${host}/project/${projectId}`, {
    method: 'DELETE',
  })
}

function getOutputFile(response, type) {
  for (const file of response.compile.outputFiles) {
    if (file.type === type && file.url.match(`output.${type}`)) {
      return file
    }
  }
  return null
}

function runFakeFilestoreService(directory) {
  const app = express()
  app.use(express.static(directory))
  this.startFakeFilestoreApp(app)
}

function startFakeFilestoreApp(app) {
  let server
  before(function (done) {
    server = app.listen(error => {
      if (error) {
        done(new Error('error starting server: ' + error.message))
      } else {
        const addr = server.address()
        Settings.filestoreDomainOveride = `http://127.0.0.1:${addr.port}`
        done()
      }
    })
  })
  after(function (done) {
    server.close(done)
  })
}

function syncFromCode(projectId, file, line, column) {
  return syncFromCodeWithImage(projectId, file, line, column, '')
}

async function syncFromCodeWithImage(projectId, file, line, column, imageName) {
  const url = new URL(`${host}/project/${projectId}/sync/code`)
  url.searchParams.append('imageName', imageName)
  url.searchParams.append('file', file)
  url.searchParams.append('line', line)
  url.searchParams.append('column', column)
  return await fetchJson(url)
}

function syncFromPdf(projectId, page, h, v) {
  return syncFromPdfWithImage(projectId, page, h, v, '')
}

function syncFromPdfWithImage(projectId, page, h, v, imageName) {
  const url = new URL(`${host}/project/${projectId}/sync/pdf`)
  url.searchParams.append('imageName', imageName)
  url.searchParams.append('page', page)
  url.searchParams.append('h', h)
  url.searchParams.append('v', v)
  return fetchJson(url)
}

function wordcount(projectId, file) {
  const image = undefined
  return wordcountWithImage(projectId, file, image)
}

async function wordcountWithImage(projectId, file, image) {
  const url = new URL(`${host}/project/${projectId}/wordcount`)
  if (image) {
    url.searchParams.append('image', image)
  }
  url.searchParams.append('file', file)
  return await fetchJson(url)
}

async function compileDirectory(projectId, baseDirectory, directory) {
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
          'Rnw',
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
          url: `http://filestore/${directory}/${entity}`,
          modified: stat.mtime,
        })
      }
    }
  }

  const req = {
    resources,
    rootResourcePath,
  }

  try {
    const options = await fsPromises.readFile(
      `${baseDirectory}/${directory}/options.json`
    )
    req.options = JSON.parse(options)
  } catch (error) {
    // noop
  }

  return await compile(projectId, req)
}

function smokeTest() {
  return fetchString(`${host}/smoke_test_force`, {
    method: 'GET',
  })
}

module.exports = {
  randomId,
  compile,
  stopCompile,
  clearCache,
  getOutputFile,
  smokeTest,
  runFakeFilestoreService,
  startFakeFilestoreApp,
  syncFromCode,
  syncFromCodeWithImage,
  syncFromPdf,
  syncFromPdfWithImage,
  compileDirectory,
  wordcount,
  wordcountWithImage,
}
