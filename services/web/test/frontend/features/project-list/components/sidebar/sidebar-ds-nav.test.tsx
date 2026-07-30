import { screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import SidebarDsNav from '../../../../../../frontend/js/features/project-list/components/sidebar/sidebar-ds-nav'
import {
  renderWithProjectListContext,
  resetProjectListContextFetch,
} from '../../helpers/render-with-context'
import { UserSettingsProvider } from '@/shared/context/user-settings-context'

async function renderSidebar(props: {
  activePage: 'library' | 'projects'
  trashActive?: boolean
}) {
  renderWithProjectListContext(
    <UserSettingsProvider>
      <SidebarDsNav {...props} />
    </UserSettingsProvider>
  )
  await waitFor(
    () => expect(fetchMock.callHistory.called('/api/project')).to.be.true
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
})
