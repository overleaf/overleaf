import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { expect } from 'chai'
import fetchMock from 'fetch-mock'
import LoadMore from '../../../../../frontend/js/features/project-list/components/load-more'
import { Project } from '../../../../../types/project/dashboard/api'
import { projectsData } from '../fixtures/projects-data'
import { renderWithProjectListContext } from '../helpers/render-with-context'

describe('<LoadMore />', function () {
  afterEach(function () {
    fetchMock.reset()
  })

  it('renders on a project list longer than 40', async function () {
    // archived and trashed projects are currently not shown
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )
    let longProjectsData: Project[] = filteredProjects
    const MULTIPLY_FACTOR = 10
    // longProjectsData.length = 55
    for (let i = 0; i < MULTIPLY_FACTOR; i++) {
      longProjectsData = [...longProjectsData, ...filteredProjects]
    }

    renderWithProjectListContext(<LoadMore />, { projects: longProjectsData })

    await screen.findByRole('button', {
      name: /Show 20 more projects/i,
    })

    await screen.findByText(
      `Showing 20 out of ${longProjectsData.length} projects.`
    )

    await screen.findByRole('button', {
      name: /Show all projects/i,
    })
  })

  it('renders on a project list longer than 20 and shorter than 40', async function () {
    // archived and trashed projects are currently not shown
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )
    let longProjectsData: Project[] = filteredProjects
    const MULTIPLY_FACTOR = 5
    // longProjectsData.length = 30
    for (let i = 0; i < MULTIPLY_FACTOR; i++) {
      longProjectsData = [...longProjectsData, ...filteredProjects]
    }

    renderWithProjectListContext(<LoadMore />, { projects: longProjectsData })

    await screen.findByRole('button', {
      name: new RegExp(
        `Show ${longProjectsData.length - 20} more projects`,
        'i'
      ),
    })

    await screen.findByText(
      `Showing 20 out of ${longProjectsData.length} projects.`
    )

    await screen.findByRole('button', {
      name: /Show all projects/i,
    })
  })

  it('renders on a project list shorter than 20', async function () {
    // archived and trashed projects are currently not shown
    // filteredProjects.length = 5
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )

    renderWithProjectListContext(<LoadMore />, { projects: filteredProjects })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Show all' })).to.not.exist
      screen.getByText(
        `Showing ${filteredProjects.length} out of ${filteredProjects.length} projects.`
      )
    })
  })

  it('change text when pressing the "Show 20 more" once for project list longer than 40', async function () {
    // archived and trashed projects are currently not shown
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )
    let longProjectsData: Project[] = filteredProjects
    const MULTIPLY_FACTOR = 10
    // longProjectsData.length = 55
    for (let i = 0; i < MULTIPLY_FACTOR; i++) {
      longProjectsData = [...longProjectsData, ...filteredProjects]
    }

    renderWithProjectListContext(<LoadMore />, { projects: longProjectsData })

    await waitFor(() => {
      const showMoreBtn = screen.getByRole('button', {
        name: /Show 20 more projects/i,
      })
      fireEvent.click(showMoreBtn)

      screen.getByRole('button', {
        name: /Show 15 more/i,
      })
      screen.getByText(`Showing 40 out of ${longProjectsData.length} projects.`)
    })
  })

  it('change text when pressing the "Show 20 more" once for project list longer than 20 and shorter than 40', async function () {
    // archived and trashed projects are currently not shown
    const filteredProjects = projectsData.filter(
      ({ archived, trashed }) => !archived && !trashed
    )
    let longProjectsData: Project[] = filteredProjects
    const MULTIPLY_FACTOR = 5
    // longProjectsData.length = 30
    for (let i = 0; i < MULTIPLY_FACTOR; i++) {
      longProjectsData = [...longProjectsData, ...filteredProjects]
    }

    renderWithProjectListContext(<LoadMore />, { projects: longProjectsData })

    await waitFor(() => {
      const showMoreBtn = screen.getByRole('button', {
        name: /Show 10 more projects/i,
      })
      fireEvent.click(showMoreBtn)

      expect(screen.queryByRole('button', { name: /Show/ })).to.not.exist
      screen.getByText(
        `Showing ${longProjectsData.length} out of ${longProjectsData.length} projects.`
      )
    })
  })
})
