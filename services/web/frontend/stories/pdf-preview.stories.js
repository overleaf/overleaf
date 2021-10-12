import { withContextRoot } from './utils/with-context-root'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import { setupContext } from './fixtures/context'
import { Button } from 'react-bootstrap'
import PdfPreviewProvider, {
  usePdfPreviewContext,
} from '../js/features/pdf-preview/contexts/pdf-preview-context'
import PdfPreviewPane from '../js/features/pdf-preview/components/pdf-preview-pane'
import PdfPreview from '../js/features/pdf-preview/components/pdf-preview'
import PdfPreviewToolbar from '../js/features/pdf-preview/components/pdf-preview-toolbar'
import PdfFileList from '../js/features/pdf-preview/components/pdf-file-list'
import { buildFileList } from '../js/features/pdf-preview/util/file-list'
import PdfLogsViewer from '../js/features/pdf-preview/components/pdf-logs-viewer'
import examplePdf from './fixtures/storybook-example.pdf'
import PdfPreviewError from '../js/features/pdf-preview/components/pdf-preview-error'
import PdfPreviewHybridToolbar from '../js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'

setupContext()

export default {
  title: 'PDF Preview',
  component: PdfPreview,
  subcomponents: {
    PdfPreviewToolbar,
    PdfPreviewHybridToolbar,
    PdfFileList,
    PdfPreviewError,
  },
}

const project = {
  _id: 'a-project',
  name: 'A Project',
  features: {},
  tokens: {},
  owner: {
    _id: 'a-user',
    email: 'stories@overleaf.com',
  },
  members: [],
  invites: [],
}

const scope = {
  project,
  settings: {
    syntaxValidation: true,
  },
  hasLintingError: false,
  $applyAsync: () => {},
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
  },
}

const dispatchProjectJoined = () => {
  window.dispatchEvent(new CustomEvent('project:joined', { detail: project }))
}

const dispatchDocChanged = () => {
  window.dispatchEvent(
    new CustomEvent('doc:changed', { detail: { doc_id: 'foo' } })
  )
}

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

const mockCompile = (fetchMock, delay = 1000) =>
  fetchMock.post(
    'express:/project/:projectId/compile',
    {
      body: {
        status: 'success',
        clsiServerId: 'foo',
        compileGroup: 'priority',
        pdfDownloadDomain: '',
        outputFiles,
      },
    },
    { delay }
  )

const mockCompileError = (fetchMock, status = 'success', delay = 1000) =>
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

const mockCompileValidationIssues = (
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
    { delay, overwriteRoutes: true }
  )

const mockClearCache = fetchMock =>
  fetchMock.delete('express:/project/:projectId/output', 204, {
    delay: 1000,
  })

const mockBuildFile = fetchMock =>
  fetchMock.get(
    'express:/build/:file',
    (url, options, request) => {
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
          return 404
      }
    },
    { sendAsJson: false }
  )

export const Interactive = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
    mockBuildFile(fetchMock)
    mockClearCache(fetchMock)
  })

  useEffect(() => {
    dispatchProjectJoined()
  }, [])

  const Inner = () => {
    const context = usePdfPreviewContext()

    const { setHasLintingError } = context

    const toggleLintingError = useCallback(() => {
      setHasLintingError(value => !value)
    }, [setHasLintingError])

    const values = useMemo(() => {
      const entries = Object.entries(context).sort((a, b) => {
        return a[0].localeCompare(b[0])
      })

      const values = { boolean: [], other: [] }

      for (const entry of entries) {
        const type = typeof entry[1]

        if (type === 'boolean') {
          values.boolean.push(entry)
        } else if (type !== 'function') {
          values.other.push(entry)
        }
      }

      return values
    }, [context])

    return (
      <div
        style={{
          padding: 20,
          background: 'white',
          float: 'left',
          zIndex: 10,
          position: 'absolute',
          top: 60,
          bottom: 60,
          right: 20,
          left: 400,
          overflow: 'hidden',
          boxShadow: '0px 2px 5px #ccc',
          borderRadius: 3,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 14,
            gap: 20,
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <div style={{ height: '100%', overflow: 'auto', flexShrink: 0 }}>
            <table>
              <tbody>
                {values.boolean.map(([key, value]) => {
                  return (
                    <tr key={key} style={{ border: '1px solid #ddd' }}>
                      <td style={{ padding: 5 }}>{value ? '🟢' : '🔴'}</td>
                      <th style={{ padding: 5 }}>{key}</th>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  margin: '10px 0',
                }}
              >
                <Button onClick={dispatchDocChanged}>trigger doc change</Button>
                <Button onClick={toggleLintingError}>
                  toggle linting error
                </Button>
              </div>
            </div>
          </div>

          <div style={{ height: '100%', overflow: 'auto' }}>
            <table
              style={{
                width: '100%',
                overflow: 'hidden',
              }}
            >
              <tbody>
                {values.other.map(([key, value]) => {
                  return (
                    <tr
                      key={key}
                      style={{
                        width: '100%',
                        overflow: 'hidden',
                        border: '1px solid #ddd',
                      }}
                    >
                      <th
                        style={{
                          verticalAlign: 'top',
                          padding: 5,
                        }}
                      >
                        {key}
                      </th>
                      <td
                        style={{
                          overflow: 'auto',
                          padding: 5,
                        }}
                      >
                        <pre
                          style={{
                            margin: '0 10px',
                            fontSize: 10,
                          }}
                        >
                          {JSON.stringify(value, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return withContextRoot(
    <div className="pdf-viewer">
      <PdfPreviewProvider>
        <PdfPreviewPane />
        <Inner />
      </PdfPreviewProvider>
    </div>,
    scope
  )
}

const compileStatuses = [
  'autocompile-backoff',
  'clear-cache',
  'clsi-maintenance',
  'compile-in-progress',
  'exited',
  'failure',
  'generic',
  'project-too-large',
  'rate-limited',
  'success',
  'terminated',
  'timedout',
  'too-recently-compiled',
  'unavailable',
  'validation-problems',
  'foo',
]

export const CompileError = () => {
  const [status, setStatus] = useState('success')

  useFetchMock(fetchMock => {
    mockCompileError(fetchMock, status, 0)
    mockBuildFile(fetchMock)
  })

  const Inner = () => {
    const { startCompile } = usePdfPreviewContext()

    const handleStatusChange = useCallback(
      event => {
        setStatus(event.target.value)
        window.setTimeout(() => {
          startCompile()
        }, 0)
      },
      [startCompile]
    )

    return (
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 10,
          background: 'white',
          padding: 10,
        }}
      >
        <label>
          {'status: '}
          <select value={status} onInput={handleStatusChange}>
            {compileStatuses.map(status => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
      </div>
    )
  }

  return withContextRoot(
    <PdfPreviewProvider>
      <PdfPreviewPane />
      <Inner />
    </PdfPreviewProvider>,
    scope
  )
}

const compileErrors = [
  'autocompile-backoff',
  'clear-cache',
  'clsi-maintenance',
  'compile-in-progress',
  'exited',
  'failure',
  'generic',
  'project-too-large',
  'rate-limited',
  'success',
  'terminated',
  'timedout',
  'too-recently-compiled',
  'unavailable',
  'validation-problems',
  'foo',
]

export const DisplayError = () => {
  return withContextRoot(
    <PdfPreviewProvider>
      {compileErrors.map(error => (
        <div
          key={error}
          style={{ background: '#5d6879', padding: 10, margin: 5 }}
        >
          <div style={{ fontFamily: 'monospace', color: 'white' }}>{error}</div>
          <PdfPreviewError error={error} />
        </div>
      ))}
    </PdfPreviewProvider>,
    scope
  )
}

export const Toolbar = () => {
  useFetchMock(fetchMock => mockCompile(fetchMock, 500))

  return withContextRoot(
    <PdfPreviewProvider>
      <div className="pdf">
        <PdfPreviewToolbar />
      </div>
    </PdfPreviewProvider>,
    scope
  )
}

export const HybridToolbar = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock, 500)
    mockBuildFile(fetchMock)
  })

  return withContextRoot(
    <PdfPreviewProvider>
      <div className="pdf">
        <PdfPreviewHybridToolbar />
      </div>
    </PdfPreviewProvider>,
    scope
  )
}

export const FileList = () => {
  const fileList = useMemo(() => {
    return buildFileList(outputFiles)
  }, [])

  return (
    <div className="dropdown open">
      <div className="dropdown-menu">
        <PdfFileList fileList={fileList} />
      </div>
    </div>
  )
}

export const Logs = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock, 0)
    mockBuildFile(fetchMock)
    mockClearCache(fetchMock)
  })

  useEffect(() => {
    dispatchProjectJoined()
  }, [])

  return withContextRoot(
    <PdfPreviewProvider>
      <div className="pdf">
        <PdfLogsViewer />
      </div>
    </PdfPreviewProvider>,
    scope
  )
}

const validationProblems = {
  sizeCheck: {
    resources: [
      { path: 'foo/bar', kbSize: 76221 },
      { path: 'bar/baz', kbSize: 2342 },
    ],
  },
  mainFile: true,
  conflictedPaths: [
    {
      path: 'foo/bar',
    },
    {
      path: 'foo/baz',
    },
  ],
}

export const ValidationIssues = () => {
  useFetchMock(fetchMock => {
    mockCompileValidationIssues(fetchMock, validationProblems, 0)
    mockBuildFile(fetchMock)
  })

  useEffect(() => {
    dispatchProjectJoined()
  }, [])

  return withContextRoot(
    <PdfPreviewProvider>
      <PdfPreviewPane />
    </PdfPreviewProvider>,
    scope
  )
}
