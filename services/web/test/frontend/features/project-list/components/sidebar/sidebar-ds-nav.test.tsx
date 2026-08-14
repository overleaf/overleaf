import { screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import SidebarDsNav from '../../../../../../frontend/js/features/project-list/components/sidebar/sidebar-ds-nav'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../helpers/render-with-context'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'
import { useProjectListContext } from '@/features/project-list/context/project-list-context'
import { Affiliation } from '../../../../../../types/affiliation'

function ProjectListLoadingProbe() {
  const { isLoading } = useProjectListContext()
  return (
    <div data-testid="project-list-loading-probe" data-loading={isLoading} />
  )
}

async function renderSidebar(props: {
  activePage: 'library' | 'projects'
  trashActive?: boolean
}) {
  renderWithProjectListContext(
    <UserSettingsProvider>
      <SidebarDsNav {...props} />
      <ProjectListLoadingProbe />
    </UserSettingsProvider>
  )
  // Wait for the projects fetch to resolve and the project list state (which
  // the "add affiliation" widget's visibility partly depends on) to settle,
  // not just for the request to have been made.
  await waitFor(() =>
    expect(
      screen.getByTestId('project-list-loading-probe').dataset.loading
    ).to.equal('false')
  )
}

describe('<SidebarDsNav />', function () {
  beforeEach(function () {
    global.localStorage.clear()
    window.metaAttributesCache.set('ol-tags', [])
    window.metaAttributesCache.set('ol-ExposedSettings', { isOverleaf: true })
    window.metaAttributesCache.set('ol-splitTestVariants', {
      'overleaf-library': 'enabled',
    })
    window.metaAttributesCache.set('ol-userSettings', {})
    window.metaAttributesCache.set('ol-navbar', {
      sessionUser: { email: 'fake@example.com' },
      showSubscriptionLink: false,
      items: [],
    })
  })

  afterEach(function () {
    resetProjectListContextFetch()
    window.history.replaceState(null, '', '/project')
  })

  it('marks trash as the current page and not the library link', async function () {
    await renderSidebar({ activePage: 'library', trashActive: true })

    expect(
      screen.getByRole('button', { name: 'Trash' }).getAttribute('aria-current')
    ).to.equal('page')
    expect(
      screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')
    ).to.be.null
  })

  it('marks the library link as the current page on the library view', async function () {
    await renderSidebar({ activePage: 'library' })

    expect(
      screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')
    ).to.equal('page')
    expect(
      screen.getByRole('button', { name: 'Trash' }).getAttribute('aria-current')
    ).to.be.null
  })

  it('ignores the project trash filter on the library view', async function () {
    window.history.replaceState(null, '', '/project/trashed')

    await renderSidebar({ activePage: 'library' })

    expect(
      screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')
    ).to.equal('page')
    expect(
      screen.getByRole('button', { name: 'Trash' }).getAttribute('aria-current')
    ).to.be.null
  })

  describe('add affiliation widget', function () {
    it('shows the widget on the library page when the user has no affiliations', async function () {
      window.metaAttributesCache.set('ol-userAffiliations', [])

      await renderSidebar({ activePage: 'library' })

      await screen.findByText(/are you affiliated with an institution/i)
    })

    it('shows the widget on the projects page when the user has no affiliations', async function () {
      window.metaAttributesCache.set('ol-userAffiliations', [])

      await renderSidebar({ activePage: 'projects' })

      await screen.findByText(/are you affiliated with an institution/i)
    })

    it('hides the widget on the library page when the user has affiliations', async function () {
      window.metaAttributesCache.set('ol-userAffiliations', [{} as Affiliation])

      await renderSidebar({ activePage: 'library' })

      expect(screen.queryByText(/are you affiliated with an institution/i)).to
        .be.null
    })

    it('hides the widget on the projects page when the user has affiliations', async function () {
      window.metaAttributesCache.set('ol-userAffiliations', [{} as Affiliation])

      await renderSidebar({ activePage: 'projects' })

      expect(screen.queryByText(/are you affiliated with an institution/i)).to
        .be.null
    })
  })
})
