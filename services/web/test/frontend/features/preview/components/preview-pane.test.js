import React from 'react'
import { screen, render, fireEvent } from '@testing-library/react'
import PreviewPane from '../../../../../frontend/js/features/preview/components/preview-pane'
const { expect } = require('chai')

describe('<PreviewPane />', function() {
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

  describe('first error pop-up', function() {
    it('renders a first error pop-up with the first error', function() {
      const propsAfterCompileWithErrors = getProps(false, {
        errors: [sampleError1, sampleError2],
        warnings: [sampleWarning]
      })
      render(<PreviewPane {...propsAfterCompileWithErrors} />)
      screen.getByRole('alertdialog', {
        name: 'Your project has errors. This is the first one.'
      })
      screen.getByText(sampleError1.message)
    })

    it('does not render a first error pop-up when there are only warnings', function() {
      const propsAfterCompileWithWarningsOnly = getProps(false, {
        errors: [],
        warnings: [sampleWarning]
      })
      render(<PreviewPane {...propsAfterCompileWithWarningsOnly} />)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })

    it('does not render a first error pop-up when a compile is ongoing', function() {
      const propsWhileCompiling = getProps(true, {
        errors: [sampleError1, sampleError2],
        warnings: [sampleWarning]
      })
      render(<PreviewPane {...propsWhileCompiling} />)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })

    it('does not render a first error pop-up when viewing logs', function() {
      const propsWithErrorsViewingLogs = getProps(
        false,
        {
          errors: [sampleError1, sampleError2],
          warnings: [sampleWarning]
        },
        Date.now(),
        true
      )
      render(<PreviewPane {...propsWithErrorsViewingLogs} />)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })

    it('does not render a first error pop-up when going back to the PDF view after viewing logs', function() {
      const nowTimestamp = Date.now()
      const propsWithErrorsViewingLogs = getProps(
        false,
        {
          errors: [sampleError1, sampleError2],
          warnings: [sampleWarning]
        },
        nowTimestamp,
        true
      )
      const propsWithErrorsAfterViewingLogs = getProps(
        false,
        {
          errors: [sampleError1, sampleError2],
          warnings: [sampleWarning]
        },
        nowTimestamp,
        false
      )
      const { rerender } = render(
        <PreviewPane {...propsWithErrorsViewingLogs} />
      )
      rerender(<PreviewPane {...propsWithErrorsAfterViewingLogs} />)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })

    it('renders a first error pop-up with updated errors after recompiling', function() {
      const nowTimestamp = Date.now()
      const laterTimestamp = Date.now() + 1000
      const propsWithErrorsAfterFirstCompile = getProps(
        false,
        {
          errors: [sampleError1, sampleError2],
          warnings: [sampleWarning]
        },
        nowTimestamp,
        true
      )
      const propsWithErrorsAfterSecondCompile = getProps(
        false,
        {
          errors: [sampleError2],
          warnings: [sampleWarning]
        },
        laterTimestamp,
        false
      )
      const { rerender } = render(
        <PreviewPane {...propsWithErrorsAfterFirstCompile} />
      )
      rerender(<PreviewPane {...propsWithErrorsAfterSecondCompile} />)
      screen.getByRole('alertdialog', {
        name: 'Your project has errors. This is the first one.'
      })
      screen.getByText(sampleError2.message)
    })

    it('allows dismissing the first error pop-up', function() {
      const propsWithErrors = getProps(false, {
        errors: [sampleError1, sampleError2],
        warnings: [sampleWarning]
      })
      render(<PreviewPane {...propsWithErrors} />)
      const dismissPopUpButton = screen.getByRole('button', {
        name: 'Dismiss first error alert'
      })

      fireEvent.click(dismissPopUpButton)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })

    it('does not render the first error pop-up with new recompiles after it being dismissed once', function() {
      const nowTimestamp = Date.now()
      const laterTimestamp = Date.now() + 1000
      const propsWithErrorsForFirstCompile = getProps(
        false,
        {
          errors: [sampleError1, sampleError2],
          warnings: [sampleWarning]
        },
        nowTimestamp
      )
      const propsWithErrorsForSecondCompile = getProps(
        false,
        {
          errors: [sampleError2],
          warnings: [sampleWarning]
        },
        laterTimestamp
      )
      const { rerender } = render(
        <PreviewPane {...propsWithErrorsForFirstCompile} />
      )
      const dismissPopUpButton = screen.getByRole('button', {
        name: 'Dismiss first error alert'
      })
      fireEvent.click(dismissPopUpButton)
      rerender(<PreviewPane {...propsWithErrorsForSecondCompile} />)
      expect(
        screen.queryByRole('alertdialog', {
          name: 'Your project has errors. This is the first one.'
        })
      ).to.not.exist
    })
  })

  describe('accessible description of the compile result', function() {
    it('renders an accessible description with the errors and warnings count', function() {
      const errors = [sampleError1, sampleError2]
      const warnings = [sampleWarning]
      const propsWithErrorsAndWarnings = getProps(false, {
        errors,
        warnings
      })
      render(<PreviewPane {...propsWithErrorsAndWarnings} />)

      screen.getByText(`${errors.length} error${errors.length > 1 ? 's' : ''}`)
      screen.getByText(
        `${warnings.length} warning${warnings.length > 1 ? 's' : ''}`
      )
    })
    it('renders an accessible description for failed compiles with CLSI errors', function() {
      const sampleCLSIError = {
        clsiMaintenance: true
      }

      const propsWithCLSIError = getProps(
        false,
        {},
        Date.now(),
        false,
        true,
        {},
        sampleCLSIError
      )
      render(<PreviewPane {...propsWithCLSIError} />)

      screen.getByText('Your project did not compile because of an error')
    })

    it('renders an accessible description for failed compiles with validation issues', function() {
      const sampleValidationIssue = {
        clsiMaintenance: true
      }

      const propsWithValidationIssue = getProps(
        false,
        {},
        Date.now(),
        false,
        true,
        sampleValidationIssue,
        {}
      )
      render(<PreviewPane {...propsWithValidationIssue} />)

      screen.getByText(
        'Your project did not compile because of a validation issue'
      )
    })
  })

  function getProps(
    isCompiling = false,
    logEntries = {},
    lastCompileTimestamp = Date.now(),
    isShowingLogs = false,
    compileFailed = false,
    validationIssues = {},
    errors = {}
  ) {
    return {
      compilerState: {
        isAutoCompileOn: false,
        isCompiling: isCompiling,
        isClearingCache: false,
        isDraftModeOn: false,
        isSyntaxCheckOn: false,
        lastCompileTimestamp,
        logEntries,
        compileFailed,
        validationIssues,
        errors
      },
      onClearCache: () => {},
      onLogEntryLocationClick: () => {},
      onRecompile: () => {},
      onRunSyntaxCheckNow: () => {},
      onSetAutoCompile: () => {},
      onSetDraftMode: () => {},
      onSetSyntaxCheck: () => {},
      onToggleLogs: () => {},
      showLogs: isShowingLogs
    }
  }
})
