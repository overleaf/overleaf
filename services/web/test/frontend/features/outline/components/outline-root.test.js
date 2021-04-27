import { expect } from 'chai'
import React from 'react'
import { screen, render } from '@testing-library/react'

import OutlineRoot from '../../../../../frontend/js/features/outline/components/outline-root'

describe('<OutlineRoot />', function () {
  const jumpToLine = () => {}

  it('renders outline', function () {
    const outline = [
      {
        title: 'Section',
        line: 1,
        level: 10,
      },
    ]
    render(<OutlineRoot outline={outline} jumpToLine={jumpToLine} />)

    screen.getByRole('tree')
    expect(screen.queryByRole('link')).to.be.null
  })

  it('renders placeholder', function () {
    const outline = []
    render(<OutlineRoot outline={outline} jumpToLine={jumpToLine} />)

    expect(screen.queryByRole('tree')).to.be.null
    screen.getByRole('link')
  })
})
