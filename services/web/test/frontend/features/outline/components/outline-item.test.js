import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'

import OutlineItem from '../../../../../frontend/js/features/outline/components/outline-item'

describe('<OutlineItem />', function() {
  before(function() {
    this.jumpToLine = sinon.stub()
  })

  afterEach(function() {
    this.jumpToLine.reset()
  })

  it('renders basic item', function() {
    const outlineItem = {
      title: 'Test Title',
      line: 1
    }
    render(
      <OutlineItem outlineItem={outlineItem} jumpToLine={this.jumpToLine} />
    )

    screen.getByRole('treeitem', { current: false })
    screen.getByRole('button', { name: outlineItem.title })
    expect(screen.queryByRole('button', { name: 'Collapse' })).to.not.exist
  })

  it('collapses and expands', function() {
    const outlineItem = {
      title: 'Parent',
      line: 1,
      children: [{ title: 'Child', line: 2 }]
    }
    render(
      <OutlineItem outlineItem={outlineItem} jumpToLine={this.jumpToLine} />
    )

    const collapseButton = screen.getByRole('button', { name: 'Collapse' })

    // test that children are rendered
    screen.getByRole('button', { name: 'Child' })

    fireEvent.click(collapseButton)

    screen.getByRole('button', { name: 'Expand' })

    expect(screen.queryByRole('button', { name: 'Child' })).to.not.exist
  })

  it('highlights', function() {
    const outlineItem = {
      title: 'Parent',
      line: 1
    }

    render(
      <OutlineItem
        outlineItem={outlineItem}
        jumpToLine={this.jumpToLine}
        highlightedLine={1}
      />
    )

    screen.getByRole('treeitem', { current: true })
  })

  it('highlights when has collapsed highlighted child', function() {
    const outlineItem = {
      title: 'Parent',
      line: 1,
      children: [{ title: 'Child', line: 2 }]
    }
    render(
      <OutlineItem
        outlineItem={outlineItem}
        jumpToLine={this.jumpToLine}
        highlightedLine={2}
      />
    )

    screen.getByRole('treeitem', { name: 'Parent', current: false })
    screen.getByRole('treeitem', { name: 'Child', current: true })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))

    screen.getByRole('treeitem', { name: 'Parent', current: true })
  })

  it('click and double-click jump to location', function() {
    const outlineItem = {
      title: 'Parent',
      line: 1
    }
    render(
      <OutlineItem outlineItem={outlineItem} jumpToLine={this.jumpToLine} />
    )

    const titleButton = screen.getByRole('button', { name: outlineItem.title })

    fireEvent.click(titleButton)
    sinon.assert.calledOnce(this.jumpToLine)
    sinon.assert.calledWith(this.jumpToLine, 1, false)

    this.jumpToLine.reset()
    fireEvent.doubleClick(titleButton)
    sinon.assert.calledOnce(this.jumpToLine)
    sinon.assert.calledWith(this.jumpToLine, 1, true)
  })
})
