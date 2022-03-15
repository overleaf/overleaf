import fetchMock from 'fetch-mock'
import { cloneDeep } from 'lodash'
import nock from 'nock'
import fs from 'fs'
import path from 'path'

export const examplePDF = path.join(__dirname, '../fixtures/test-example.pdf')
export const corruptPDF = path.join(
  __dirname,
  '../fixtures/test-example-corrupt.pdf'
)

const outputFiles = [
  {
    path: 'output.pdf',
    build: '123',
    url: '/build/output.pdf',
    type: 'pdf',
  },
  {
    path: 'output.bbl',
    build: '123',
    url: '/build/output.bbl',
    type: 'bbl',
  },
  {
    path: 'output.bib',
    build: '123',
    url: '/build/output.bib',
    type: 'bib',
  },
  {
    path: 'example.txt',
    build: '123',
    url: '/build/example.txt',
    type: 'txt',
  },
  {
    path: 'output.log',
    build: '123',
    url: '/build/output.log',
    type: 'log',
  },
  {
    path: 'output.blg',
    build: '123',
    url: '/build/output.blg',
    type: 'blg',
  },
]

export const mockCompile = (delayPromise = Promise.resolve()) =>
  fetchMock.post(
    'express:/project/:projectId/compile',
    delayPromise.then(() => ({
      body: {
        status: 'success',
        clsiServerId: 'foo',
        compileGroup: 'priority',
        pdfDownloadDomain: 'https://clsi.test-overleaf.com',
        outputFiles: cloneDeep(outputFiles),
      },
    }))
  )

export const mockCompileError = status =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status,
      clsiServerId: 'foo',
      compileGroup: 'priority',
    },
  })

export const mockValidationProblems = validationProblems =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status: 'validation-problems',
      validationProblems,
      clsiServerId: 'foo',
      compileGroup: 'priority',
    },
  })

export const mockClearCache = () =>
  fetchMock.delete('express:/project/:projectId/output', 204)

export const mockValidPdf = () => {
  nock('https://clsi.test-overleaf.com')
    .get(/^\/build\/output\.pdf/)
    .replyWithFile(200, examplePDF)
}

export const defaultFileResponses = {
  '/build/output.pdf': () => fs.createReadStream(examplePDF),
  '/build/output.blg': 'This is BibTeX, Version 4.0', // FIXME
  '/build/output.log': `
The LaTeX compiler output
  * With a lot of details

Wrapped in an HTML <pre> element with
      preformatted text which is to be presented exactly
            as written in the HTML file

                                              (whitespace included™)

The text is typically rendered using a non-proportional ("monospace") font.

LaTeX Font Info:    External font \`cmex10' loaded for size
(Font)              <7> on input line 18.
LaTeX Font Info:    External font \`cmex10' loaded for size
(Font)              <5> on input line 18.
! Undefined control sequence.
<recently read> \\Zlpha

 main.tex, line 23

`,
}

export const mockBuildFile = (responses = defaultFileResponses) => {
  fetchMock.get('begin:https://clsi.test-overleaf.com/', _url => {
    const url = new URL(_url, 'https://clsi.test-overleaf.com')

    if (url.pathname in responses) {
      return responses[url.pathname]
    }

    return 404
  })

  fetchMock.get('express:/build/:file', (_url, options, request) => {
    const url = new URL(_url, 'https://example.com')

    if (url.pathname in responses) {
      return responses[url.pathname]
    }

    return 404
  })
}
