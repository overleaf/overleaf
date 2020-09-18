import { expect } from 'chai'
import React from 'react'
import sinon from 'sinon'
import { screen, render, fireEvent } from '@testing-library/react'

import OutlinePane from '../../../../../frontend/js/features/outline/components/outline-pane'

describe('<OutlinePane />', function() {
  const jumpToLine = () => {}
  const projectId = '123abc'
  const onToggle = sinon.stub()
  const eventTracking = { sendMB: sinon.stub() }

  before(function() {
    global.localStorage = {
      getItem: sinon.stub().returns(null),
      setItem: sinon.stub()
    }
  })

  afterEach(function() {
    onToggle.reset()
    eventTracking.sendMB.reset()
    global.localStorage.getItem.resetHistory()
    global.localStorage.setItem.resetHistory()
  })

  after(function() {
    delete global.localStorage
  })

  it('renders expanded outline', function() {
    const outline = [
      {
        title: 'Section',
        line: 1,
        level: 10
      }
    ]
    render(
      <OutlinePane
        isTexFile
        outline={outline}
        projectId={projectId}
        jumpToLine={jumpToLine}
        onToggle={onToggle}
        eventTracking={eventTracking}
      />
    )

    screen.getByRole('tree')
    screen.getByRole('link', { textMatch: 'The File outline is a new feature' })
  })

  it('renders disabled outline', function() {
    const outline = []
    render(
      <OutlinePane
        isTexFile={false}
        outline={outline}
        projectId={projectId}
        jumpToLine={jumpToLine}
        onToggle={onToggle}
        eventTracking={eventTracking}
      />
    )

    expect(screen.queryByRole('tree')).to.be.null
  })

  it('expand outline and use local storage', function() {
    global.localStorage.getItem.returns(false)
    const outline = [
      {
        title: 'Section',
        line: 1,
        level: 10
      }
    ]
    render(
      <OutlinePane
        isTexFile
        outline={outline}
        projectId={projectId}
        jumpToLine={jumpToLine}
        onToggle={onToggle}
        eventTracking={eventTracking}
      />
    )

    expect(screen.queryByRole('tree')).to.be.null
    const collapseButton = screen.getByRole('button', {
      name: 'Show File outline'
    })
    fireEvent.click(collapseButton)

    screen.getByRole('tree')
    expect(global.localStorage.setItem).to.be.calledOnce
    expect(global.localStorage.setItem).to.be.calledWithMatch(/123abc/, 'true')
    expect(onToggle).to.be.calledTwice
  })
})
