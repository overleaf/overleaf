import { fireEvent, render, screen } from '@testing-library/react'
import WelcomeMessageNew from '../../../../../frontend/js/features/project-list/components/welcome-message-new'
import { expect } from 'chai'

describe('<WelcomeMessageNew />', function () {
  afterEach(function () {
    window.metaAttributesCache = new Map()
  })

  it('renders welcome page correctly', function () {
    render(<WelcomeMessageNew />)

    screen.getByText('Welcome to Overleaf!')
    screen.getByText('Create a new project')
    screen.getByText('Learn LaTeX with a tutorial')
    screen.getByText('Browse templates')
  })

  it('shows correct dropdown when clicking create a new project', function () {
    render(<WelcomeMessageNew />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)

    screen.getByText('Blank Project')
    screen.getByText('Example Project')
    screen.getByText('Upload Project')
    screen.getByText('Import from GitHub')
  })

  it('show the correct dropdown menu for affiliated users', function () {
    window.metaAttributesCache.set('ol-portalTemplates', [
      {
        name: 'Affiliation 1',
        url: '/edu/test-new-template',
      },
    ])

    render(<WelcomeMessageNew />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)
    // static menu
    screen.getByText('Blank Project')
    screen.getByText('Example Project')
    screen.getByText('Upload Project')
    screen.getByText('Import from GitHub')

    // static text for institution templates
    screen.getByText('Institution Templates')

    // dynamic menu based on portalTemplates
    const affiliationTemplate = screen.getByRole('link', {
      name: 'Affiliation 1',
    })

    expect(affiliationTemplate.getAttribute('href')).to.equal(
      '/edu/test-new-template#templates'
    )
  })

  it('shows correct dropdown when clicking create a new project with a portal template', function () {
    render(<WelcomeMessageNew />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)

    screen.getByText('Blank Project')
    screen.getByText('Example Project')
    screen.getByText('Upload Project')
    screen.getByText('Import from GitHub')
  })

  it('shows correct link for latex tutorial menu', function () {
    render(<WelcomeMessageNew />)

    const link = screen.getByRole('link', {
      name: 'Learn LaTeX with a tutorial',
    })

    expect(link.getAttribute('href')).to.equal(
      '/learn/latex/Learn_LaTeX_in_30_minutes'
    )
  })

  it('shows correct link for browse templates menu', function () {
    render(<WelcomeMessageNew />)

    const link = screen.getByRole('link', {
      name: 'Browse templates',
    })

    expect(link.getAttribute('href')).to.equal('/templates')
  })
})
