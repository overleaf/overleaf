import React from 'react'
import { screen, render } from '@testing-library/react'

import PreviewLogsToggleButton from '../../../../../frontend/js/features/preview/components/preview-logs-toggle-button'

describe('<PreviewLogsToggleButton />', function() {
  describe('basic toggle functionality', function() {
    const logsState = {
      nErrors: 0,
      nWarnings: 0,
      nLogEntries: 0
    }
    const onToggleLogs = () => {}
    it('should render a view logs button when previewing the PDF', function() {
      const showLogs = false
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', { name: 'View logs' })
    })
    it('should render a view PDF button when viewing logs', function() {
      const showLogs = true
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', { name: 'View PDF' })
    })
  })
  describe('compile status indicator', function() {
    const showLogs = false
    const onToggleLogs = () => {}
    it('should render a view logs button by default', function() {
      const logsState = {
        nErrors: 0,
        nWarnings: 0,
        nLogEntries: 0
      }
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', { name: 'View logs' })
    })

    it('should render an error status message when there are errors', function() {
      const logsState = {
        nErrors: 1,
        nWarnings: 0,
        nLogEntries: 0
      }
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', {
        name: `Your project has errors (${logsState.nErrors})`
      })
    })

    it('should render an error status message when there are both errors and warnings', function() {
      const logsState = {
        nErrors: 1,
        nWarnings: 1,
        nLogEntries: 0
      }
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', {
        name: `Your project has errors (${logsState.nErrors})`
      })
    })

    it('should render a warning status message when there are warnings but no errors', function() {
      const logsState = {
        nErrors: 0,
        nWarnings: 1,
        nLogEntries: 0
      }
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', {
        name: `View warnings (${logsState.nWarnings})`
      })
    })

    it('should render 9+ errors when there are more than nine errors', function() {
      const logsState = {
        nErrors: 10,
        nWarnings: 0,
        nLogEntries: 0
      }
      render(
        <PreviewLogsToggleButton
          logsState={logsState}
          showLogs={showLogs}
          onToggle={onToggleLogs}
        />
      )
      screen.getByRole('button', { name: `Your project has errors (9+)` })
    })
  })
})
