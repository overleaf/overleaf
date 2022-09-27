import SearchForm from '../../js/features/project-list/components/search-form'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import { projectsData } from '../../../test/frontend/features/project-list/fixtures/projects-data'

export const Search = (args: any) => {
  useFetchMock(fetchMock => {
    fetchMock.post(/\/api\/project/, {
      projects: projectsData,
      totalSize: projectsData.length,
    })
  })

  return (
    <ProjectListProvider>
      <SearchForm {...args} />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / Project Search',
  component: SearchForm,
  args: {
    inputValue: '',
  },
}
