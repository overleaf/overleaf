import React from 'react'
import { expect } from 'chai'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'

import PreviewLogsPaneEntry from '../../../../../frontend/js/features/preview/components/preview-logs-pane-entry.js'

describe('<PreviewLogsPaneEntry />', function () {
  const level = 'error'

  it('renders a configurable aria-label', function () {
    const sampleAriaLabel = 'lorem ipsum dolor sit amet'
    render(
      <PreviewLogsPaneEntry entryAriaLabel={sampleAriaLabel} level={level} />
    )
    screen.getByLabelText(sampleAriaLabel)
  })

  describe('logs pane source location link', function () {
    const file = 'foo.tex'
    const line = 42
    const column = 21
    const onSourceLocationClick = sinon.stub()

    afterEach(function () {
      onSourceLocationClick.reset()
    })

    it('renders both file and line', function () {
      render(
        <PreviewLogsPaneEntry sourceLocation={{ file, line }} level={level} />
      )
      screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}, ${line}`
      })
    })

    it('renders only file when line information is not available', function () {
      render(<PreviewLogsPaneEntry sourceLocation={{ file }} level={level} />)
      screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}`
      })
    })

    it('does not render when file information is not available', function () {
      render(<PreviewLogsPaneEntry level={level} />)
      expect(
        screen.queryByRole('button', {
          name: `Navigate to log position in source code: `
        })
      ).to.not.exist
    })

    it('calls the callback with file, line and column on click', function () {
      render(
        <PreviewLogsPaneEntry
          sourceLocation={{ file, line, column }}
          level={level}
          onSourceLocationClick={onSourceLocationClick}
        />
      )
      const linkToSourceButton = screen.getByRole('button', {
        name: `Navigate to log position in source code: ${file}, ${line}`
      })

      fireEvent.click(linkToSourceButton)
      expect(onSourceLocationClick).to.be.calledOnce
      expect(onSourceLocationClick).to.be.calledWith({
        file,
        line,
        column
      })
    })
  })

  describe('logs pane entry raw contents', function () {
    const rawContent = 'foo bar latex error stuff baz'

    // JSDom doesn't compute layout/sizing, so we need to simulate sizing for the elements
    // Here we are simulating that the content is bigger than the `collapsedSize`, so
    // the expand-collapse widget is used
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight'
    )
    const originalScrollWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth'
    )

    beforeEach(function () {
      Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
        configurable: true,
        value: 500
      })
      Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
        configurable: true,
        value: 500
      })
    })

    afterEach(function () {
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollHeight',
        originalScrollHeight
      )
      Object.defineProperty(
        HTMLElement.prototype,
        'scrollWidth',
        originalScrollWidth
      )
    })

    it('renders collapsed contents by default', function () {
      render(<PreviewLogsPaneEntry rawContent={rawContent} level={level} />)
      screen.getByText(rawContent)
      screen.getByRole('button', {
        name: 'Expand'
      })
    })

    it('supports expanding contents', function () {
      render(<PreviewLogsPaneEntry rawContent={rawContent} level={level} />)
      screen.getByText(rawContent)
      const expandCollapseBtn = screen.getByRole('button', {
        name: 'Expand'
      })
      fireEvent.click(expandCollapseBtn)
      screen.getByRole('button', {
        name: 'Collapse'
      })
    })

    it('should not render at all when there are no log contents', function () {
      const { container } = render(<PreviewLogsPaneEntry level={level} />)
      expect(container.querySelector('.log-entry-content')).to.not.exist
    })
  })

  describe('formatted content', function () {
    const rawContent = 'foo bar latex error stuff baz'
    const formattedContentText = 'foo bar baz'
    const formattedContent = <>{formattedContentText}</>
    const infoURL = 'www.overleaf.com/learn/latex'

    it('renders the hint', function () {
      render(
        <PreviewLogsPaneEntry
          rawContent={rawContent}
          formattedContent={formattedContent}
          extraInfoURL={infoURL}
          level={level}
        />
      )
      screen.getByText(formattedContentText)
    })

    it('renders the link to learn more', function () {
      render(
        <PreviewLogsPaneEntry
          rawContent={rawContent}
          formattedContent={formattedContent}
          extraInfoURL={infoURL}
          level={level}
        />
      )
      screen.getByRole('link', { name: 'Learn more' })
    })

    it('does not render the link when it is not available', function () {
      render(
        <PreviewLogsPaneEntry
          rawContent={rawContent}
          formattedContent={formattedContent}
          level={level}
        />
      )
      expect(screen.queryByRole('link', { name: 'Learn more' })).to.not.exist
    })
  })
})
