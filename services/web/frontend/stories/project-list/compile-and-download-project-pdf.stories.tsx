import ProjectListTable from '../../js/features/project-list/components/table/project-list-table'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import { projectsData } from '../../../test/frontend/features/project-list/fixtures/projects-data'

export const Successful = (args: any) => {
  window.metaAttributesCache.set('ol-user_id', '624333f147cfd8002622a1d3')
  useFetchMock(fetchMock => {
    fetchMock.post(/\/api\/project/, {
      projects: projectsData,
      totalSize: projectsData.length,
    })
    fetchMock.post(
      /\/compile/,
      {
        status: 'success',
        compileGroup: 'standard',
        clsiServerId: 'server-1',
        outputFiles: [{ path: 'output.pdf', build: '123-321' }],
      },
      {
        delay: 1_000,
      }
    )
  })

  return (
    <ProjectListProvider>
      <ProjectListTable {...args} />
    </ProjectListProvider>
  )
}

export const Failure = (args: any) => {
  window.metaAttributesCache.set('ol-user_id', '624333f147cfd8002622a1d3')
  useFetchMock(fetchMock => {
    fetchMock.post(/\/api\/project/, {
      projects: projectsData,
      totalSize: projectsData.length,
    })
    fetchMock.post(
      /\/compile/,
      { status: 'failure', outputFiles: [] },
      { delay: 1_000 }
    )
  })

  return (
    <ProjectListProvider>
      <ProjectListTable {...args} />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / PDF download',
  component: ProjectListTable,
  decorators: [
    (Story: any) => (
      <div className="project-list-react">
        <Story />
      </div>
    ),
  ],
}
