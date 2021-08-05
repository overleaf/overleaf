import { screen, render } from '@testing-library/react'

import OutlineList from '../../../../../frontend/js/features/outline/components/outline-list'

describe('<OutlineList />', function () {
  const jumpToLine = () => {}

  it('renders items', function () {
    const outline = [
      {
        title: 'Section 1',
        line: 1,
        level: 10,
      },
      {
        title: 'Section 2',
        line: 2,
        level: 10,
      },
    ]
    render(<OutlineList outline={outline} isRoot jumpToLine={jumpToLine} />)

    screen.getByRole('treeitem', { name: 'Section 1' })
    screen.getByRole('treeitem', { name: 'Section 2' })
  })

  it('renders as root', function () {
    const outline = [
      {
        title: 'Section',
        line: 1,
        level: 10,
      },
    ]
    render(<OutlineList outline={outline} isRoot jumpToLine={jumpToLine} />)

    screen.getByRole('tree')
  })

  it('renders as non-root', function () {
    const outline = [
      {
        title: 'Section',
        line: 1,
        level: 10,
      },
    ]
    render(<OutlineList outline={outline} jumpToLine={jumpToLine} />)

    screen.getByRole('group')
  })
})
