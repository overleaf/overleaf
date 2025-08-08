import { useCallback, useMemo, useState } from 'react'
import useFetchMock from './hooks/use-fetch-mock'
import OLButton from '@/shared/components/ol/ol-button'
import PdfPreviewPane from '../js/features/pdf-preview/components/pdf-preview-pane'
import PdfPreview from '../js/features/pdf-preview/components/pdf-preview'
import PdfFileList from '../js/features/pdf-preview/components/pdf-file-list'
import { buildFileList } from '../js/features/pdf-preview/util/file-list'
import PdfLogsViewer from '../js/features/pdf-preview/components/pdf-logs-viewer'
import PdfPreviewError from '../js/features/pdf-preview/components/pdf-preview-error'
import PdfPreviewHybridToolbar from '../js/features/pdf-preview/components/pdf-preview-hybrid-toolbar'
import { useDetachCompileContext as useCompileContext } from '../js/shared/context/detach-compile-context'
import {
  dispatchDocChanged,
  mockBuildFile,
  mockClearCache,
  mockCompile,
  mockCompileError,
  mockCompileValidationIssues,
  mockEventTracking,
  outputFiles,
} from './fixtures/compile'
import { cloneDeep } from 'lodash'
import { ScopeDecorator } from './decorators/scope'
import { PdfPreviewProvider } from '@/features/pdf-preview/components/pdf-preview-provider'
import {
  Dropdown,
  DropdownMenu,
} from '@/shared/components/dropdown/dropdown-menu'

export default {
  title: 'Editor / PDF Preview',
  component: PdfPreview,
  subcomponents: {
    PdfPreviewHybridToolbar,
    PdfFileList,
    PdfPreviewError,
  },
  decorators: [ScopeDecorator],
}

export const Interactive = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
    mockBuildFile(fetchMock)
    mockClearCache(fetchMock)
  })

  const Inner = () => {
    const context = useCompileContext()

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
                <OLButton onClick={dispatchDocChanged}>
                  trigger doc change
                </OLButton>
                <OLButton onClick={toggleLintingError}>
                  toggle linting error
                </OLButton>
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

  return (
    <div className="pdf-viewer">
      <PdfPreviewPane />
      <Inner />
    </div>
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
    const { startCompile } = useCompileContext()

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
          zIndex: 100,
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

  return (
    <>
      <PdfPreviewPane />
      <Inner />
    </>
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
  useFetchMock(fetchMock => {
    mockCompile(fetchMock)
  })

  return (
    <div className="logs-pane">
      {compileErrors.map(error => (
        <div
          key={error}
          style={{ background: '#5d6879', padding: 10, margin: 5 }}
        >
          <div style={{ fontFamily: 'monospace', color: 'white' }}>{error}</div>
          <PdfPreviewError error={error} />
        </div>
      ))}
    </div>
  )
}

export const HybridToolbar = () => {
  useFetchMock(fetchMock => {
    mockCompile(fetchMock, 500)
    mockBuildFile(fetchMock)
    mockEventTracking(fetchMock)
  })

  return (
    <div className="pdf">
      <PdfPreviewHybridToolbar />
    </div>
  )
}

export const FileList = () => {
  const fileList = useMemo(() => {
    return buildFileList(cloneDeep(outputFiles), {})
  }, [])

  return (
    <Dropdown>
      <DropdownMenu id="dropdown-files-logs-pane-list" show>
        <PdfFileList fileList={fileList} />
      </DropdownMenu>
    </Dropdown>
  )
}

export const Logs = () => {
  useFetchMock(fetchMock => {
    mockCompileError(fetchMock, 400, 0)
    mockBuildFile(fetchMock)
    mockClearCache(fetchMock)
  })

  return (
    <div className="pdf">
      <PdfPreviewProvider>
        <PdfLogsViewer />
      </PdfPreviewProvider>
    </div>
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

  return <PdfPreviewPane />
}
