import { render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import React from 'react'
import { ColorPickerProvider } from '../../../../../frontend/js/features/project-list/context/color-picker-context'
import { ProjectListProvider } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { Project } from '../../../../../types/project/dashboard/api'
import { projectsData } from '../fixtures/projects-data'

type Options = {
  projects?: Project[]
}

export function renderWithProjectListContext(
  component: React.ReactElement,
  options: Options = {}
) {
  let { projects } = options

  if (!projects) {
    projects = projectsData
  }

  fetchMock.post('express:/api/project', {
    status: 200,
    body: { projects, totalSize: projects.length },
  })

  fetchMock.get('express:/system/messages', {
    status: 200,
    body: [],
  })

  const ProjectListProviderWrapper = ({
    children,
  }: {
    children: React.ReactNode
  }) => (
    <ProjectListProvider>
      <ColorPickerProvider>{children}</ColorPickerProvider>
    </ProjectListProvider>
  )

  return render(component, {
    wrapper: ProjectListProviderWrapper,
  })
}

export function resetProjectListContextFetch() {
  fetchMock.reset()
}
