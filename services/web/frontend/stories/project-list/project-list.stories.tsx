import ProjectListTable from '../../js/features/project-list/components/table/project-list-table'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import {
  copyableProject,
  projectsData,
} from '../../../test/frontend/features/project-list/fixtures/projects-data'
import { useMeta } from '../hooks/use-meta'
import { tags } from '../../../test/frontend/features/project-list/fixtures/tags-data'
import { v4 as uuid } from 'uuid'

const MOCK_DELAY = 500

export const Interactive = (args: any) => {
  window.metaAttributesCache.set('ol-user_id', '624333f147cfd8002622a1d3')
  useFetchMock(fetchMock => {
    fetchMock.post(
      /\/api\/project/,
      { projects: projectsData, totalSize: projectsData.length },
      { delay: MOCK_DELAY }
    )
    fetchMock.post(
      'express:/project/:projectId/clone',
      () => ({
        project_id: uuid(),
        name: copyableProject.name,
        lastUpdated: new Date().toISOString(),
        owner: {
          _id: copyableProject.owner?.id,
          email: copyableProject.owner?.id,
          first_name: copyableProject.owner?.firstName,
          last_name: copyableProject.owner?.lastName,
        },
      }),
      { delay: MOCK_DELAY }
    )
  })

  useMeta({
    'ol-tags': tags,
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
  parameters: {
    bootstrap5: true,
  },
}
