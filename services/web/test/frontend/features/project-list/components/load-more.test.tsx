import { fireEvent, screen, waitFor } from '@testing-library/react'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import LoadMore from '../../../../../frontend/js/features/project-list/components/load-more'
import {
  projectsData,
  makeLongProjectList,
  currentProjects,
} from '../fixtures/projects-data'
import { renderWithProjectListContext } from '../helpers/render-with-context'

describe('<LoadMore />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('renders on a project list longer than 40', async function () {
    const { fullList, currentList } = makeLongProjectList(55)

    renderWithProjectListContext(<LoadMore />, {
      projects: fullList,
    })

    await screen.findByRole('button', {
      name: /Show 20 more projects/i,
    })

    await screen.findByText(`Showing 20 out of ${currentList.length} projects.`)

    await screen.findByRole('button', {
      name: /Show all projects/i,
    })
  })

  it('renders on a project list longer than 20 and shorter than 40', async function () {
    const { fullList, currentList } = makeLongProjectList(30)

    renderWithProjectListContext(<LoadMore />, { projects: fullList })

    await screen.findByRole('button', {
      name: new RegExp(`Show ${currentList.length - 20} more projects`, 'i'),
    })

    await screen.findByText(`Showing 20 out of ${currentList.length} projects.`)

    await screen.findByRole('button', {
      name: /Show all projects/i,
    })
  })

  it('renders on a project list shorter than 20', async function () {
    renderWithProjectListContext(<LoadMore />, { projects: projectsData })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show all' })).to.not.exist
      screen.getByText(
        `Showing ${currentProjects.length} out of ${currentProjects.length} projects.`
      )
    })
  })

  it('change text when pressing the "Show 20 more" once for project list longer than 40', async function () {
    const { fullList, currentList } = makeLongProjectList(55)

    renderWithProjectListContext(<LoadMore />, { projects: fullList })

    await waitFor(() => {
      const showMoreBtn = screen.getByRole('button', {
        name: /Show 20 more projects/i,
      })
      fireEvent.click(showMoreBtn)
    })

    await waitFor(() => {
      screen.getByRole('button', {
        name: `Show ${currentList.length - 20 - 20} more projects`,
      })
      screen.getByText(`Showing 40 out of ${currentList.length} projects.`)
    })
  })

  it('change text when pressing the "Show 20 more" once for project list longer than 20 and shorter than 40', async function () {
    const { fullList, currentList } = makeLongProjectList(30)

    renderWithProjectListContext(<LoadMore />, { projects: fullList })

    await waitFor(() => {
      const showMoreBtn = screen.getByRole('button', {
        name: /Show 7 more projects/i,
      })
      fireEvent.click(showMoreBtn)
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Show/ })).to.not.exist
      screen.getByText(
        `Showing ${currentList.length} out of ${currentList.length} projects.`
      )
    })
  })
})
