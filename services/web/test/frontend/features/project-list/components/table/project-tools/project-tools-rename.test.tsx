import { render, screen, within } from '@testing-library/react'
import { expect } from 'chai'
import moment from 'moment/moment'
import fetchMock from 'fetch-mock'
import { Project } from '../../../../../../../types/project/dashboard/api'
import { ProjectListRootInner } from '@/features/project-list/components/project-list-root'

const users = {
  picard: {
    id: '62d6d0b4c5c5030a4d696c7a',
    email: 'picard@overleaf.com',
    firstName: 'Jean-Luc',
    lastName: 'Picard',
  },
  riker: {
    id: '624333f147cfd8002622a1d3',
    email: 'riker@overleaf.com',
    firstName: 'William',
    lastName: 'Riker',
  },
}

const projects: Project[] = [
  {
    id: '62f17f594641b405ca2b3264',
    name: 'Starfleet Report (owner)',
    lastUpdated: moment().subtract(1, 'day').toISOString(),
    lastUpdatedBy: users.riker,
    accessLevel: 'owner',
    source: 'owner',
    archived: false,
    trashed: false,
    owner: users.picard,
  },
  {
    id: '62f17f594641b405ca2b3265',
    name: 'Starfleet Report (readAndWrite)',
    lastUpdated: moment().subtract(1, 'day').toISOString(),
    lastUpdatedBy: users.picard,
    accessLevel: 'readAndWrite',
    source: 'owner',
    archived: false,
    trashed: false,
    owner: users.riker,
  },
]

describe('<ProjectTools />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-user', {})
    window.metaAttributesCache.set('ol-prefetchedProjectsBlob', {
      projects,
      totalSize: 100,
    })
    fetchMock.get('/system/messages', [])
  })

  afterEach(function () {
    window.metaAttributesCache.clear()
    fetchMock.reset()
  })

  it('does not show the Rename option for a project owned by a different user', function () {
    render(<ProjectListRootInner />)
    screen.getByLabelText('Select Starfleet Report (readAndWrite)').click()
    screen.getByRole('button', { name: 'More' }).click()
    expect(
      within(
        screen.getByTestId('project-tools-more-dropdown-menu')
      ).queryByRole('menuitem', { name: 'Rename' })
    ).to.be.null
  })

  it('displays the Rename option for a project owned by the current user', function () {
    render(<ProjectListRootInner />)
    screen.getByLabelText('Select Starfleet Report (owner)').click()
    screen.getByRole('button', { name: 'More' }).click()
    within(screen.getByTestId('project-tools-more-dropdown-menu'))
      .getByRole('menuitem', { name: 'Rename' })
      .click()
    within(screen.getByRole('dialog')).getByText('Rename Project')
  })
})
