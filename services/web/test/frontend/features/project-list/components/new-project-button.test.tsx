import { fireEvent, screen } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import NewProjectButton from '../../../../../frontend/js/features/project-list/components/new-project-button'
import { renderWithProjectListContext } from '../helpers/render-with-context'
import getMeta from '@/utils/meta'

describe('<NewProjectButton />', function () {
  beforeEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  describe('for every user (affiliated and non-affiliated)', function () {
    beforeEach(function () {
      Object.assign(getMeta('ol-ExposedSettings'), {
        templateLinks: [
          {
            name: 'Journal articles',
            url: '/gallery/tagged/academic-journal',
          },
          {
            name: 'View All',
            url: '/latex/templates',
          },
        ],
      })

      renderWithProjectListContext(<NewProjectButton id="test" />)

      const newProjectButton = screen.getByRole('button', {
        name: 'New project',
      })
      fireEvent.click(newProjectButton)
    })

    it('shows the correct dropdown menu', function () {
      // static menu
      screen.getByText('Blank project')
      screen.getByText('Example project')
      screen.getByText('Upload project')
      screen.getByText('Import from GitHub')

      // static text
      screen.getByText('Templates')

      // dynamic menu based on templateLinks
      screen.getByText('Journal articles')
      screen.getByText('View All')
    })

    it('open new project modal when clicking at Blank project', function () {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Blank project' }))

      screen.getByLabelText(/Project name/i)
    })

    it('open new project modal when clicking at Example project', function () {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Example project' }))

      screen.getByLabelText(/Project name/i)
    })

    it('close the new project modal when clicking at the top right "x" button', function () {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Blank project' }))
      fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }))

      expect(screen.queryByRole('dialog')).to.be.null
    })

    it('close the new project modal when clicking at the Cancel button', function () {
      fireEvent.click(screen.getByRole('menuitem', { name: 'Blank project' }))
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).to.be.null
    })
  })

  describe('for affiliated user with custom templates', function () {
    beforeEach(function () {
      Object.assign(getMeta('ol-ExposedSettings'), {
        templateLinks: [
          {
            name: 'Journal articles',
            url: '/gallery/tagged/academic-journal',
          },
          {
            name: 'View All',
            url: '/latex/templates',
          },
        ],
      })

      window.metaAttributesCache.set('ol-portalTemplates', [
        {
          name: 'Affiliation 1',
          url: '/edu/test-new-template',
        },
      ])
    })

    it('shows the correct dropdown menu', function () {
      renderWithProjectListContext(<NewProjectButton id="test" />)

      const newProjectButton = screen.getByRole('button', {
        name: 'New project',
      })

      fireEvent.click(newProjectButton)
      // static menu
      screen.getByText('Blank project')
      screen.getByText('Example project')
      screen.getByText('Upload project')
      screen.getByText('Import from GitHub')

      // static text for institution templates
      screen.getByText('Institution Templates')

      // dynamic menu based on portalTemplates
      const affiliationTemplate = screen.getByRole('menuitem', {
        name: 'Affiliation 1 Template',
      })
      expect(affiliationTemplate.getAttribute('href')).to.equal(
        '/edu/test-new-template#templates'
      )

      // static text
      screen.getByText('Templates')

      // dynamic menu based on templateLinks
      screen.getByText('Journal articles')
      screen.getByText('View All')
    })
  })
})
