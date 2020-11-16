import React from 'react'
import { screen, render, fireEvent } from '@testing-library/react'
import PreviewLogsPane from '../../../../../frontend/js/features/preview/components/preview-logs-pane'
import sinon from 'sinon'

const { expect } = require('chai')

describe('<PreviewLogsPane />', function() {
  const sampleError1 = {
    content: 'error 1 content',
    file: 'main.tex',
    level: 'error',
    line: 17,
    message: 'Misplaced alignment tab character &.'
  }
  const sampleError2 = {
    content: 'error 1 content',
    file: 'main.tex',
    level: 'error',
    line: 22,
    message: 'Extra alignment tab has been changed to cr.'
  }
  const sampleWarning = {
    file: 'main.tex',
    level: 'warning',
    line: 30,
    message: "Reference `idontexist' on page 1 undefined on input line 30."
  }
  const sampleRawLog = `
  This is pdfTeX, Version 3.14159265-2.6-1.40.21 (TeX Live 2020) (preloaded format=pdflatex 2020.9.10)  6 NOV 2020 15:23
entering extended mode
 \\write18 enabled.
 %&-line parsing enabled.
**main.tex
(/compile/main.tex
  LaTeX2e <2020-02-02> patch level 5
  L3 programming layer <2020-07-17> (/usr/local/texlive/2020/texmf-dist/tex/latex
  /base/article.cls
  Document Class: article 2019/12/20 v1.4l Standard LaTeX document class
  (/usr/local/texlive/2020/texmf-dist/tex/latex/base/size10.clo
  File: size10.clo 2019/12/20 v1.4l Standard LaTeX file (size option)
  )`
  const errors = [sampleError1, sampleError2]
  const warnings = [sampleWarning]
  const logEntries = [...errors, ...warnings]

  const onLogEntryLocationClick = sinon.stub()

  beforeEach(function() {
    render(
      <PreviewLogsPane
        logEntries={logEntries}
        rawLog={sampleRawLog}
        onLogEntryLocationClick={onLogEntryLocationClick}
      />
    )
  })
  it('renders all log entries with appropriate labels', function() {
    const errorEntries = screen.getAllByLabelText(`Log entry with level: error`)
    const warningEntries = screen.getAllByLabelText(
      `Log entry with level: warning`
    )
    expect(errorEntries).to.have.lengthOf(errors.length)
    expect(warningEntries).to.have.lengthOf(warnings.length)
  })

  it('renders the raw log', function() {
    screen.getByLabelText('Raw logs from the LaTeX compiler')
  })

  it('renders a link to location button for every error and warning log entry', function() {
    logEntries.forEach((entry, index) => {
      const linkToSourceButton = screen.getByRole('button', {
        name: `Navigate to log position in source code: ${entry.file}, ${
          entry.line
        }`
      })
      fireEvent.click(linkToSourceButton)
      expect(onLogEntryLocationClick).to.have.callCount(index + 1)
      const call = onLogEntryLocationClick.getCall(index)
      expect(
        call.calledWith({
          file: entry.file,
          line: entry.line,
          column: entry.column
        })
      ).to.be.true
    })
  })
  it('does not render a link to location button for the raw log entry', function() {
    const rawLogEntry = screen.getByLabelText(
      'Raw logs from the LaTeX compiler'
    )
    expect(rawLogEntry.querySelector('.log-entry-header-link')).to.not.exist
  })
})
