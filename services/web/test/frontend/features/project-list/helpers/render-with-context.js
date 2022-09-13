// Disable prop type checks for test harnesses
/* eslint-disable react/prop-types */

import { render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import { ProjectListProvider } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { projectsData } from '../fixtures/projects-data'

export function renderWithProjectListContext(component, contextProps) {
  fetchMock.post('express:/api/project', {
    status: 200,
    body: { projects: projectsData },
  })
  const ProjectListProviderWrapper = ({ children }) => (
    <ProjectListProvider {...contextProps}>{children}</ProjectListProvider>
  )

  return render(component, {
    wrapper: ProjectListProviderWrapper,
  })
}

export function resetProjectListContextFetch() {
  fetchMock.reset()
}
