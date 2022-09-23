import { render, fireEvent, screen } from '@testing-library/react'
import { expect } from 'chai'
import NewProjectButton from '../../../../../frontend/js/features/project-list/components/new-project-button'

describe('<NewProjectButton />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-ExposedSettings', {
      templateLinks: [
        {
          name: 'Academic Journal',
          url: '/gallery/tagged/academic-journal',
        },
        {
          name: 'View All',
          url: '/latex/templates',
        },
      ],
    })

    render(<NewProjectButton id="test" />)

    const newProjectButton = screen.getByRole('button', {
      name: 'New Project',
    })
    fireEvent.click(newProjectButton)
  })

  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('opens a dropdown', function () {
    // static menu
    screen.getByText('Blank Project')
    screen.getByText('Example Project')
    screen.getByText('Upload Project')
    screen.getByText('Import from GitHub')

    // static text
    screen.getByText('Templates')

    // dynamic menu based on templateLinks
    screen.getByText('Academic Journal')
    screen.getByText('View All')
  })

  it('open new project modal when clicking at Blank Project', function () {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Project' }))

    screen.getByPlaceholderText('Project Name')
  })

  it('open new project modal when clicking at Example Project', function () {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Example Project' }))

    screen.getByPlaceholderText('Project Name')
  })

  it('close the new project modal when clicking at the top right "x" button', function () {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Project' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByRole('dialog')).to.be.null
  })

  it('close the new project modal when clicking at the Cancel button', function () {
    fireEvent.click(screen.getByRole('menuitem', { name: 'Blank Project' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).to.be.null
  })
})
