import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import PdfPreview from '../../../../../frontend/js/features/pdf-preview/components/pdf-preview'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import nock from 'nock'
import path from 'path'
import fs from 'fs'
import { cloneDeep } from 'lodash'

const examplePDF = path.join(__dirname, '../fixtures/test-example.pdf')
const corruptPDF = path.join(__dirname, '../fixtures/test-example-corrupt.pdf')

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

const mockCompile = () =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status: 'success',
      clsiServerId: 'foo',
      compileGroup: 'priority',
      pdfDownloadDomain: 'https://clsi.test-overleaf.com',
      outputFiles: cloneDeep(outputFiles),
    },
  })

const mockCompileError = status =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status,
      clsiServerId: 'foo',
      compileGroup: 'priority',
    },
  })

const mockValidationProblems = validationProblems =>
  fetchMock.post('express:/project/:projectId/compile', {
    body: {
      status: 'validation-problems',
      validationProblems,
      clsiServerId: 'foo',
      compileGroup: 'priority',
    },
  })

const mockClearCache = () =>
  fetchMock.delete('express:/project/:projectId/output', 204)

const mockValidPdf = () => {
  nock('https://clsi.test-overleaf.com')
    .get(/^\/build\/output\.pdf/)
    .replyWithFile(200, examplePDF)
}

const defaultFileResponses = {
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

const mockBuildFile = (responses = defaultFileResponses) => {
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

const storeAndFireEvent = (key, value) => {
  localStorage.setItem(key, value)
  fireEvent(window, new StorageEvent('storage', { key }))
}

const scope = {
  settings: {
    syntaxValidation: false,
  },
  editor: {
    sharejs_doc: {
      doc_id: 'test-doc',
      getSnapshot: () => 'some doc content',
    },
  },
}

describe('<PdfPreview/>', function () {
  let clock

  beforeEach(function () {
    window.showNewPdfPreview = true
    clock = sinon.useFakeTimers({
      shouldAdvanceTime: true,
      now: Date.now(),
    })
    nock.cleanAll()
  })

  afterEach(function () {
    window.showNewPdfPreview = undefined
    clock.runAll()
    clock.restore()
    fetchMock.reset()
    localStorage.clear()
    sinon.restore()
  })

  it('renders the PDF preview', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })
  })

  it('runs a compile when the Recompile button is pressed', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    mockValidPdf()

    // press the Recompile button => compile
    const button = screen.getByRole('button', { name: 'Recompile' })
    button.click()
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(6)
  })

  it('runs a compile on doc change if autocompile is enabled', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // switch on auto compile
    storeAndFireEvent('autocompile_enabled:project123', true)

    mockValidPdf()

    // fire a doc:changed event => compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE

    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(6)
  })

  it('does not run a compile on doc change if autocompile is disabled', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // make sure auto compile is switched off
    storeAndFireEvent('autocompile_enabled:project123', false)

    // fire a doc:changed event => no compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE
    screen.getByRole('button', { name: 'Recompile' })

    expect(fetchMock.calls()).to.have.length(3)
  })

  it('does not run a compile on doc change if autocompile is blocked by syntax check', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, {
      scope: {
        ...scope,
        'settings.syntaxValidation': true, // enable linting in the editor
        hasLintingError: true, // mock a linting error
      },
    })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // switch on auto compile and syntax checking
    storeAndFireEvent('autocompile_enabled:project123', true)
    storeAndFireEvent('stop_on_validation_error:project123', true)

    // fire a doc:changed event => no compile
    fireEvent(window, new CustomEvent('doc:changed'))
    clock.tick(2000) // AUTO_COMPILE_DEBOUNCE
    screen.getByRole('button', { name: 'Recompile' })
    await screen.findByText('Code check failed')

    expect(fetchMock.calls()).to.have.length(3)
  })

  describe('displays error messages', function () {
    const compileErrorStatuses = {
      'clear-cache':
        'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
      'clsi-maintenance':
        'The compile servers are down for maintenance, and will be back shortly.',
      'compile-in-progress':
        'A previous compile is still running. Please wait a minute and try compiling again.',
      exited: 'Server Error',
      failure: 'No PDF',
      generic: 'Server Error',
      'project-too-large': 'Project too large',
      'rate-limited': 'Compile rate limit hit',
      terminated: 'Compilation cancelled',
      timedout: 'Timed out',
      'too-recently-compiled':
        'This project was compiled very recently, so this compile has been skipped.',
      unavailable:
        'Sorry, the compile server for your project was temporarily unavailable. Please try again in a few moments.',
      foo:
        'Sorry, something went wrong and your project could not be compiled. Please try again in a few moments.',
    }

    for (const [status, message] of Object.entries(compileErrorStatuses)) {
      it(`displays error message for '${status}' status`, async function () {
        cleanup()
        fetchMock.restore()
        mockCompileError(status)

        renderWithEditorContext(<PdfPreview />, { scope })

        // wait for "compile on load" to finish
        await screen.findByRole('button', { name: 'Compiling…' })
        await screen.findByRole('button', { name: 'Recompile' })

        screen.getByText(message)
      })
    }
  })

  it('displays expandable raw logs', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    // pretend that the content is large enough to trigger a "collapse"
    // (in jsdom these values are always zero)
    sinon.stub(HTMLElement.prototype, 'scrollHeight').value(500)
    sinon.stub(HTMLElement.prototype, 'scrollWidth').value(500)

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    const logsButton = screen.getByRole('button', { name: 'View logs' })
    logsButton.click()

    await screen.findByRole('button', { name: 'View PDF' })

    // expand the log
    const [expandButton] = screen.getAllByRole('button', { name: 'Expand' })
    expandButton.click()

    // collapse the log
    const [collapseButton] = screen.getAllByRole('button', { name: 'Collapse' })
    collapseButton.click()
  })

  it('displays error messages if there were validation problems', async function () {
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

    mockValidationProblems(validationProblems)

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    screen.getByText('Project too large')
    screen.getByText('Unknown main document')
    screen.getByText('Conflicting Paths Found')

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be
      .false // TODO: actual path
  })

  it('sends a clear cache request when the button is pressed', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    const logsButton = screen.getByRole('button', {
      name: 'View logs',
    })
    logsButton.click()

    const clearCacheButton = await screen.findByRole('button', {
      name: 'Clear cached files',
    })
    expect(clearCacheButton.hasAttribute('disabled')).to.be.false

    mockClearCache()

    // click the button
    clearCacheButton.click()
    expect(clearCacheButton.hasAttribute('disabled')).to.be.true
    await waitFor(() => {
      expect(clearCacheButton.hasAttribute('disabled')).to.be.false
    })

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be.true // TODO: actual path
  })

  it('handle "recompile from scratch"', async function () {
    mockCompile()
    mockBuildFile()
    mockValidPdf()

    renderWithEditorContext(<PdfPreview />, { scope })

    // wait for "compile on load" to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    // show the logs UI
    const logsButton = screen.getByRole('button', {
      name: 'View logs',
    })
    logsButton.click()

    const clearCacheButton = await screen.findByRole('button', {
      name: 'Clear cached files',
    })
    expect(clearCacheButton.hasAttribute('disabled')).to.be.false

    mockValidPdf()
    mockClearCache()

    const recompileFromScratch = screen.getByRole('menuitem', {
      name: 'Recompile from scratch',
      hidden: true,
    })
    recompileFromScratch.click()

    expect(clearCacheButton.hasAttribute('disabled')).to.be.true

    // wait for compile to finish
    await screen.findByRole('button', { name: 'Compiling…' })
    await screen.findByRole('button', { name: 'Recompile' })

    expect(fetchMock.called('express:/project/:projectId/compile')).to.be.true // TODO: auto_compile query param
    expect(fetchMock.called('express:/project/:projectId/output')).to.be.true
    expect(fetchMock.called('begin:https://clsi.test-overleaf.com/')).to.be.true // TODO: actual path
  })

  it('shows an error for an invalid URL', async function () {
    mockCompile()
    mockBuildFile()

    nock('https://clsi.test-overleaf.com')
      .get(/^\/build\/output.pdf/)
      .replyWithError({
        message: 'something awful happened',
        code: 'AWFUL_ERROR',
      })

    renderWithEditorContext(<PdfPreview />, { scope })

    await screen.findByText('Something went wrong while rendering this PDF.')
    expect(screen.queryByLabelText('Page 1')).to.not.exist

    expect(nock.isDone()).to.be.true
  })

  it('shows an error for a corrupt PDF', async function () {
    mockCompile()
    mockBuildFile()

    nock('https://clsi.test-overleaf.com')
      .get(/^\/build\/output.pdf/)
      .replyWithFile(200, corruptPDF)

    renderWithEditorContext(<PdfPreview />, { scope })

    await screen.findByText('Something went wrong while rendering this PDF.')
    expect(screen.queryByLabelText('Page 1')).to.not.exist

    expect(nock.isDone()).to.be.true
  })
})
