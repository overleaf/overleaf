import AddAffiliation from '../../js/features/project-list/components/add-affiliation'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import { projectsData } from '../../../test/frontend/features/project-list/fixtures/projects-data'
import getMeta from '@/utils/meta'

export const Add = (args: any) => {
  Object.assign(getMeta('ol-ExposedSettings'), {
    isOverleaf: true,
  })
  window.metaAttributesCache.set('ol-userAffiliations', [])
  useFetchMock(fetchMock => {
    fetchMock.post(/\/api\/project/, {
      projects: projectsData,
      totalSize: projectsData.length,
    })
  })

  return (
    <ProjectListProvider>
      <AddAffiliation {...args} />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / Affiliation',
  component: AddAffiliation,
}
