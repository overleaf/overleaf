import React from 'react'
import { expect } from 'chai'
import { screen, render } from '@testing-library/react'

import PreviewLogsToggleButton from '../../../../../frontend/js/features/preview/components/preview-logs-toggle-button'

describe('<PreviewLogsToggleButton />', function () {
  function renderPreviewLogsToggleButton(
    logsState,
    onToggleLogs,
    showLogs,
    showText = false,
    autoCompileLintingError = false,
    compileFailed = false
  ) {
    render(
      <PreviewLogsToggleButton
        logsState={logsState}
        onToggle={onToggleLogs}
        showLogs={showLogs}
        showText={showText}
        autoCompileLintingError={autoCompileLintingError}
        compileFailed={compileFailed}
      />
    )
  }

  describe('basic toggle functionality', function () {
    const logsState = {
      nErrors: 0,
      nWarnings: 0,
    }
    const onToggleLogs = () => {}
    it('should render a view logs button when previewing the PDF', function () {
      const showLogs = false
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText('View logs')
    })
    it('should render a view PDF button when viewing logs', function () {
      const showLogs = true
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText('View PDF')
    })
  })
  describe('compile status indicator', function () {
    const showLogs = false
    const onToggleLogs = () => {}
    it('should render a view logs button by default', function () {
      const logsState = {
        nErrors: 0,
        nWarnings: 0,
      }
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText('View logs')
    })

    it('should render the code check failed notice', function () {
      const logsState = {
        nErrors: 1,
        nWarnings: 0,
      }
      renderPreviewLogsToggleButton(
        logsState,
        onToggleLogs,
        showLogs,
        false,
        true
      )
      screen.getByText('Code check failed')
    })

    it('should render an error status message when there are errors', function () {
      const logsState = {
        nErrors: 1,
        nWarnings: 0,
      }
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText(`This project has errors (${logsState.nErrors})`)
    })

    it('should render an error status message when there are both errors and warnings', function () {
      const logsState = {
        nErrors: 1,
        nWarnings: 1,
      }
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText(`This project has errors (${logsState.nErrors})`)
    })

    it('should render a warning status message when there are warnings but no errors', function () {
      const logsState = {
        nErrors: 0,
        nWarnings: 1,
      }
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText(`View warnings (${logsState.nWarnings})`)
    })

    it('should render 99+ errors when there are more than 99 errors', function () {
      const logsState = {
        nErrors: 100,
        nWarnings: 0,
      }
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs)
      screen.getByText('This project has errors (99+)')
    })
    it('should show the button text when prop showText=true', function () {
      const logsState = {
        nErrors: 0,
        nWarnings: 0,
      }
      const showText = true
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs, showText)
      expect(screen.getByText('View logs').getAttribute('style')).to.be.null
    })
    it('should not show the button text when prop showText=false', function () {
      const logsState = {
        nErrors: 0,
        nWarnings: 0,
      }
      const showText = false
      renderPreviewLogsToggleButton(logsState, onToggleLogs, showLogs, showText)
      expect(screen.getByText('View logs').getAttribute('style')).to.equal(
        'position: absolute; right: -100vw;'
      )
    })
  })
})
