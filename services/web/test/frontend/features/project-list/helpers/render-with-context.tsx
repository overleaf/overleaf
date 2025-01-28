import { render } from '@testing-library/react'
import fetchMock from 'fetch-mock'
import React from 'react'
import { ColorPickerProvider } from '../../../../../frontend/js/features/project-list/context/color-picker-context'
import { ProjectListProvider } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { Project } from '../../../../../types/project/dashboard/api'
import { projectsData } from '../fixtures/projects-data'
import { SplitTestProvider } from '@/shared/context/split-test-context'
import { UserProvider } from '@/shared/context/user-context'

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

  window.metaAttributesCache.set('ol-user', {
    id: 'fake_user',
    first_name: 'fake_user_first_name',
    email: 'fake@example.com',
  })

  const ProjectListProviderWrapper = ({
    children,
  }: {
    children: React.ReactNode
  }) => (
    <UserProvider>
      <ProjectListProvider>
        <SplitTestProvider>
          <ColorPickerProvider>{children}</ColorPickerProvider>
        </SplitTestProvider>
      </ProjectListProvider>
    </UserProvider>
  )

  return render(component, {
    wrapper: ProjectListProviderWrapper,
  })
}

export function resetProjectListContextFetch() {
  fetchMock.reset()
}
