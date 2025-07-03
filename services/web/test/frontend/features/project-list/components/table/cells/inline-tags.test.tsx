import { expect } from 'chai'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import {
  resetProjectListContextFetch,
  renderWithProjectListContext,
} from '../../../helpers/render-with-context'
import InlineTags from '../../../../../../../frontend/js/features/project-list/components/table/cells/inline-tags'
import {
  archivedProject,
  copyableProject,
} from '../../../fixtures/projects-data'

describe('<InlineTags />', function () {
  beforeEach(function () {
    window.metaAttributesCache.set('ol-tags', [
      {
        _id: '789fff789fff',
        name: 'My Test Tag',
        project_ids: [copyableProject.id, archivedProject.id],
      },
      {
        _id: '555eee555eee',
        name: 'Tag 2',
        project_ids: [copyableProject.id],
      },
      {
        _id: '444ddd444ddd',
        name: 'Tag 3',
        project_ids: [archivedProject.id],
      },
    ])
    this.projectId = copyableProject.id
  })

  afterEach(function () {
    resetProjectListContextFetch()
  })

  it('renders tags list for a project', function () {
    renderWithProjectListContext(<InlineTags projectId={this.projectId} />)
    screen.getByText('My Test Tag')
    screen.getByText('Tag 2')
    expect(screen.queryByText('Tag 3')).to.not.exist
  })

  it('handles removing a project from a tag', async function () {
    fetchMock.delete(
      `express:/tag/789fff789fff/project/${copyableProject.id}`,
      {
        status: 204,
      },
      { delay: 0 }
    )

    renderWithProjectListContext(<InlineTags projectId={this.projectId} />)
    const removeButton = screen.getByRole('button', {
      name: 'Remove tag My Test Tag',
    })
    fireEvent.click(removeButton)
    await waitFor(
      () =>
        expect(
          fetchMock.callHistory.called(
            `/tag/789fff789fff/project/${copyableProject.id}`,
            {
              method: 'DELETE',
            }
          )
        ).to.be.true
    )
    expect(screen.queryByText('My Test Tag')).to.not.exist
    screen.getByText('Tag 2')
  })
})
