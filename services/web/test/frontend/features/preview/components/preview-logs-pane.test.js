import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import PreviewLogsPane from '../../../../../frontend/js/features/preview/components/preview-logs-pane'
import sinon from 'sinon'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

const { expect } = require('chai')

describe('<PreviewLogsPane />', function () {
  const sampleError1 = {
    content: 'error 1 content',
    file: 'main.tex',
    level: 'error',
    line: 17,
    message: 'Misplaced alignment tab character &.',
  }
  const sampleError2 = {
    content: 'error 1 content',
    file: 'main.tex',
    level: 'error',
    line: 22,
    message: 'Extra alignment tab has been changed to cr.',
  }
  const sampleWarning = {
    file: 'main.tex',
    level: 'warning',
    line: 30,
    message: "Reference `idontexist' on page 1 undefined on input line 30.",
  }
  const sampleTypesettingIssue = {
    file: 'main.tex',
    level: 'typesetting',
    line: 12,
    message: "Reference `idontexist' on page 1 undefined on input line 30.",
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
  const typesetting = [sampleTypesettingIssue]
  const logEntries = {
    all: [...errors, ...warnings, ...typesetting],
    errors,
    warnings,
    typesetting,
  }
  const noOp = () => {}
  const onLogEntryLocationClick = sinon.stub()

  describe('with logs', function () {
    beforeEach(function () {
      renderWithEditorContext(
        <PreviewLogsPane
          logEntries={logEntries}
          rawLog={sampleRawLog}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
        />
      )
    })
    it('renders all log entries with appropriate labels', function () {
      const errorEntries = screen.getAllByLabelText(
        `Log entry with level: error`
      )
      const warningEntries = screen.getAllByLabelText(
        `Log entry with level: warning`
      )
      const typesettingEntries = screen.getAllByLabelText(
        `Log entry with level: typesetting`
      )
      expect(errorEntries).to.have.lengthOf(errors.length)
      expect(warningEntries).to.have.lengthOf(warnings.length)
      expect(typesettingEntries).to.have.lengthOf(typesetting.length)
    })

    it('renders the raw log', function () {
      screen.getByLabelText('Raw logs from the LaTeX compiler')
    })

    it('renders a link to location button for every error and warning log entry', function () {
      logEntries.all.forEach((entry, index) => {
        const linkToSourceButton = screen.getByRole('button', {
          name: `Navigate to log position in source code: ${entry.file}, ${entry.line}`,
        })
        fireEvent.click(linkToSourceButton)
        expect(onLogEntryLocationClick).to.have.callCount(index + 1)
        const call = onLogEntryLocationClick.getCall(index)
        expect(
          call.calledWith({
            file: entry.file,
            line: entry.line,
            column: entry.column,
          })
        ).to.be.true
      })
    })
    it(' does not render a link to location button for the raw log entry', function () {
      const rawLogEntry = screen.getByLabelText(
        'Raw logs from the LaTeX compiler'
      )
      expect(rawLogEntry.querySelector('.log-entry-header-link')).to.not.exist
    })
  })

  describe('with validation issues', function () {
    const sampleValidationIssues = {
      sizeCheck: {
        resources: [
          { path: 'foo/bar', kbSize: 76221 },
          { path: 'bar/baz', kbSize: 2342 },
        ],
      },
      mainFile: true,
    }

    it('renders a validation entry for known issues', function () {
      renderWithEditorContext(
        <PreviewLogsPane
          validationIssues={sampleValidationIssues}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
        />
      )
      const validationEntries = screen.getAllByLabelText(
        'A validation issue which prevented this project from compiling'
      )
      expect(validationEntries).to.have.lengthOf(
        Object.keys(sampleValidationIssues).length
      )
    })

    it('ignores unknown issues', function () {
      renderWithEditorContext(
        <PreviewLogsPane
          validationIssues={{ unknownIssue: true }}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
        />
      )
      const validationEntries = screen.queryAllByLabelText(
        'A validation issue prevented this project from compiling'
      )
      expect(validationEntries).to.have.lengthOf(0)
    })
  })

  describe('with compilation errors', function () {
    const sampleErrors = {
      clsiMaintenance: true,
      tooRecentlyCompiled: true,
      compileTerminated: true,
    }

    it('renders an error entry for known errors', function () {
      renderWithEditorContext(
        <PreviewLogsPane
          errors={sampleErrors}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
        />
      )
      const errorEntries = screen.getAllByLabelText(
        'An error which prevented this project from compiling'
      )
      expect(errorEntries).to.have.lengthOf(Object.keys(sampleErrors).length)
    })

    it('ignores unknown errors', function () {
      renderWithEditorContext(
        <PreviewLogsPane
          errors={{ unknownIssue: true }}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
        />
      )
      const errorEntries = screen.queryAllByLabelText(
        'There was an error compiling this project'
      )
      expect(errorEntries).to.have.lengthOf(0)
    })
  })

  describe('with failing code check', function () {
    beforeEach(function () {
      renderWithEditorContext(
        <PreviewLogsPane
          logEntries={logEntries}
          rawLog={sampleRawLog}
          onLogEntryLocationClick={onLogEntryLocationClick}
          onClearCache={noOp}
          autoCompileHasLintingError
        />
      )
    })
    it('renders a code check failed entry', function () {
      screen.getByText(
        'Your code has errors that need to be fixed before the auto-compile can run'
      )
    })
  })
})
