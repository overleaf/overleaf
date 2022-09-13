import ProjectListTable from '../../js/features/project-list/components/table/project-list-table'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import { projectsData } from '../../../test/frontend/features/project-list/fixtures/projects-data'

const MOCK_DELAY = 500

export const Interactive = (args: any) => {
  window.user_id = '624333f147cfd8002622a1d3'
  useFetchMock(fetchMock => {
    fetchMock.post(
      /\/api\/project/,
      { projects: projectsData, totalSize: projectsData.length },
      { delay: MOCK_DELAY }
    )
  })

  return (
    <ProjectListProvider>
      <ProjectListTable {...args} />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / Project Table',
  component: ProjectListTable,
  decorators: [
    (Story: any) => (
      <div className="project-list-react">
        <Story />
      </div>
    ),
  ],
}
