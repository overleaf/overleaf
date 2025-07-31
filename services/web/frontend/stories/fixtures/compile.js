import examplePdf from './storybook-example.pdf'
import { cloneDeep } from 'lodash'

export const dispatchDocChanged = () => {
  window.dispatchEvent(
    new CustomEvent('doc:changed', { detail: { doc_id: 'foo' } })
  )
}

export const outputFiles = [
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

export const mockCompile = (fetchMock, delay = 1000) =>
  fetchMock.post(
    'express:/project/:projectId/compile',
    {
      body: {
        status: 'success',
        clsiServerId: 'foo',
        compileGroup: 'priority',
        pdfDownloadDomain: '',
        outputFiles: cloneDeep(outputFiles),
      },
    },
    { delay }
  )

export const mockCompileError = (fetchMock, status = 'success', delay = 1000) =>
  fetchMock.post(
    'express:/project/:projectId/compile',
    {
      body: {
        status,
        clsiServerId: 'foo',
        compileGroup: 'priority',
      },
    },
    { delay, overwriteRoutes: true }
  )

export const mockCompileValidationIssues = (
  fetchMock,
  validationProblems,
  delay = 1000
) =>
  fetchMock.post(
    'express:/project/:projectId/compile',
    () => {
      return {
        body: {
          status: 'validation-problems',
          validationProblems,
          clsiServerId: 'foo',
          compileGroup: 'priority',
        },
      }
    },
    { delay }
  )

export const mockClearCache = fetchMock =>
  fetchMock.delete('express:/project/:projectId/output', 204, {
    delay: 1000,
  })

export const mockBuildFile = fetchMock =>
  fetchMock.get('express:/build/:file', ({ url }) => {
    const { pathname } = new URL(url, 'https://example.com')

    switch (pathname) {
      case '/build/output.blg':
        return 'This is BibTeX, Version 4.0' // FIXME

      case '/build/output.log':
        return `
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

`

      case '/build/output.pdf':
        return new Promise(resolve => {
          const xhr = new XMLHttpRequest()
          xhr.addEventListener('load', () => {
            resolve({
              status: 200,
              headers: {
                'Content-Length': xhr.getResponseHeader('Content-Length'),
                'Content-Type': xhr.getResponseHeader('Content-Type'),
              },
              body: xhr.response,
            })
          })
          xhr.open('GET', examplePdf)
          xhr.responseType = 'arraybuffer'
          xhr.send()
        })

      default:
        console.log(pathname)
        return 404
    }
  })

const mockHighlights = [
  {
    page: 1,
    h: 85.03936,
    v: 509.999878,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 486.089539,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 498.044708,
    width: 441.921265,
    height: 8.855677,
  },
  {
    page: 1,
    h: 85.03936,
    v: 521.955078,
    width: 441.921265,
    height: 8.855677,
  },
]

export const mockEventTracking = fetchMock =>
  fetchMock.get('express:/event/:event', 204)

export const mockValidPdf = fetchMock =>
  fetchMock.get('express:/build/output.pdf', () => {
    return new Promise(resolve => {
      const xhr = new XMLHttpRequest()
      xhr.addEventListener('load', () => {
        resolve({
          status: 200,
          headers: {
            'Content-Length': xhr.getResponseHeader('Content-Length'),
            'Content-Type': xhr.getResponseHeader('Content-Type'),
            'Accept-Ranges': 'bytes',
          },
          body: xhr.response,
        })
      })
      xhr.open('GET', examplePdf)
      xhr.responseType = 'arraybuffer'
      xhr.send()
    })
  })

export const mockSynctex = fetchMock =>
  fetchMock
    .get('express:/project/:projectId/sync/code', () => {
      return { pdf: cloneDeep(mockHighlights) }
    })
    .get('express:/project/:projectId/sync/pdf', () => {
      return { code: [{ file: 'main.tex', line: 100 }] }
    })
