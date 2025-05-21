import { fireEvent, render, screen } from '@testing-library/react'
import WelcomeMessage from '../../../../../frontend/js/features/project-list/components/welcome-message'
import { expect } from 'chai'
import getMeta from '@/utils/meta'

describe('<WelcomeMessage />', function () {
  beforeEach(function () {
    Object.assign(getMeta('ol-ExposedSettings'), {
      isOverleaf: true,
      wikiEnabled: true,
      templatesEnabled: true,
    })
  })

  it('renders welcome page correctly', function () {
    render(<WelcomeMessage />)

    screen.getByText('Welcome to Overleaf')
    screen.getByText('Create a new project')
    screen.getByText('Learn LaTeX with a tutorial')
    screen.getByText('Browse templates')
  })

  it('shows correct dropdown when clicking create a new project', function () {
    render(<WelcomeMessage />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)

    screen.getByText('Blank project')
    screen.getByText('Example project')
    screen.getByText('Upload project')
    screen.getByText('Import from GitHub')
  })

  it('show the correct dropdown menu for affiliated users', function () {
    window.metaAttributesCache.set('ol-portalTemplates', [
      {
        name: 'Affiliation 1',
        url: '/edu/test-new-template',
      },
    ])

    render(<WelcomeMessage />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)
    // static menu
    screen.getByText('Blank project')
    screen.getByText('Example project')
    screen.getByText('Upload project')
    screen.getByText('Import from GitHub')

    // static text for institution templates
    screen.getByText('Institution Templates')

    // dynamic menu based on portalTemplates
    const affiliationTemplate = screen.getByRole('menuitem', {
      name: 'Affiliation 1',
    })

    expect(affiliationTemplate.getAttribute('href')).to.equal(
      '/edu/test-new-template#templates'
    )
  })

  it('shows correct dropdown when clicking create a new project with a portal template', function () {
    render(<WelcomeMessage />)

    const button = screen.getByRole('button', {
      name: 'Create a new project',
    })

    fireEvent.click(button)

    screen.getByText('Blank project')
    screen.getByText('Example project')
    screen.getByText('Upload project')
    screen.getByText('Import from GitHub')
  })

  it('shows correct link for latex tutorial menu', function () {
    render(<WelcomeMessage />)

    const link = screen.getByRole('link', {
      name: 'Learn LaTeX with a tutorial',
    })

    expect(link.getAttribute('href')).to.equal(
      '/learn/latex/Learn_LaTeX_in_30_minutes'
    )
  })

  it('shows correct link for browse templates menu', function () {
    render(<WelcomeMessage />)

    const link = screen.getByRole('link', {
      name: 'Browse templates',
    })

    expect(link.getAttribute('href')).to.equal('/templates')
  })

  describe('when not in SaaS', function () {
    beforeEach(function () {
      getMeta('ol-ExposedSettings').isOverleaf = false
    })

    it('renders welcome page correctly', function () {
      render(<WelcomeMessage />)

      screen.getByText('Welcome to Overleaf')
      screen.getByText('Create a new project')
      screen.getByText('Learn LaTeX with a tutorial')
      screen.getByText('Browse templates')
    })

    it("doesn't display github in the dropdown when clicking create a new project", function () {
      render(<WelcomeMessage />)

      const button = screen.getByRole('button', {
        name: 'Create a new project',
      })

      fireEvent.click(button)

      screen.getByText('Blank project')
      screen.getByText('Example project')
      screen.getByText('Upload project')
      expect(screen.queryByText('Import from GitHub')).to.not.exist
    })

    it('does not render the tutorial link when the learn wiki is not configured', function () {
      getMeta('ol-ExposedSettings').wikiEnabled = false
      render(<WelcomeMessage />)

      expect(screen.queryByText('Learn LaTeX with a tutorial')).to.not.exist
    })

    it('does not render the templates link when templates are not configured', function () {
      getMeta('ol-ExposedSettings').templatesEnabled = false
      render(<WelcomeMessage />)

      expect(screen.queryByText('Browse templates')).to.not.exist
    })
  })
})
