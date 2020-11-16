import React from 'react'
import { expect } from 'chai'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'

import PreviewLogEntry from '../../../../../frontend/js/features/preview/components/preview-log-entry.js'

describe('<PreviewLogEntry />', function() {
  const level = 'error'

  describe('log entry description', function() {
    for (const level of ['error', 'warning', 'typesetting', 'raw']) {
      it(`describes the log entry with ${level} information`, function() {
        render(<PreviewLogEntry level={level} />)
        const expectedLabel =
          level === 'raw'
            ? 'Raw logs from the LaTeX compiler'
            : `Log entry with level: ${level}`
        screen.getByLabelText(expectedLabel)
      })
    }
  })

  describe('log location link', function() {
    const file = 'foo.tex'
    const line = 42
    const column = 21
    const onLogEntryLocationClick = sinon.stub()

    afterEach(function() {
      onLogEntryLocationClick.reset()
    })

    it('renders both file and line', function() {
      render(<PreviewLogEntry file={file} line={line} level={level} />)
      screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}, ${line}`
      })
    })

    it('renders only file when line information is not available', function() {
      render(<PreviewLogEntry file={file} level={level} />)
      screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}`
      })
    })

    it('does not render when file information is not available', function() {
      render(<PreviewLogEntry level={level} />)
      expect(
        screen.queryByRole('button', {
          name: `Navigate to log position in source code: `
        })
      ).to.not.exist
    })

    it('calls the callback with file, line and column on click', function() {
      render(
        <PreviewLogEntry
          file={file}
          line={line}
          column={column}
          level={level}
          onLogEntryLocationClick={onLogEntryLocationClick}
        />
      )
      const linkToSourceButton = screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}, ${line}`
      })

      fireEvent.click(linkToSourceButton)
      expect(onLogEntryLocationClick).to.be.calledOnce
      expect(onLogEntryLocationClick).to.be.calledWith({
        file,
        line: line,
        column: column
      })
    })
  })

  describe('log entry contents', function() {
    const logContent = 'foo bar latex error stuff baz'

    it('renders collapsed contents by default', function() {
      render(<PreviewLogEntry content={logContent} level={level} />)
      screen.getByText(logContent)
      screen.getByRole('button', {
        name: 'Expand'
      })
    })

    it('supports expanding contents', function() {
      render(<PreviewLogEntry content={logContent} level={level} />)
      screen.getByText(logContent)
      const expandCollapseBtn = screen.getByRole('button', {
        name: 'Expand'
      })
      fireEvent.click(expandCollapseBtn)
      screen.getByRole('button', {
        name: 'Collapse'
      })
    })

    it('should not render at all when there are no log contents', function() {
      const { container } = render(<PreviewLogEntry level={level} />)
      expect(container.querySelector('.log-entry-content')).to.not.exist
    })
  })

  describe('human-readable hints', function() {
    const logContent = 'foo bar latex error stuff baz'
    const logHintText = 'foo bar baz'
    const logHint = <>{logHintText}</>
    const infoURL = 'www.overleaf.com/learn/latex'

    it('renders the hint', function() {
      render(
        <PreviewLogEntry
          content={logContent}
          humanReadableHintComponent={logHint}
          extraInfoURL={infoURL}
          level={level}
        />
      )
      screen.getByText(logHintText)
    })

    it('renders the link to learn more', function() {
      render(
        <PreviewLogEntry
          content={logContent}
          humanReadableHintComponent={logHint}
          extraInfoURL={infoURL}
          level={level}
        />
      )
      screen.getByRole('link', { name: 'Learn more' })
    })

    it('does not render the link when it is not available', function() {
      render(
        <PreviewLogEntry
          content={logContent}
          humanReadableHintComponent={logHint}
          level={level}
        />
      )
      expect(screen.queryByRole('link', { name: 'Learn more' })).to.not.exist
    })
  })
})
