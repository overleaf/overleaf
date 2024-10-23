import NewProjectButton from '../../js/features/project-list/components/new-project-button'
import { ProjectListProvider } from '../../js/features/project-list/context/project-list-context'
import useFetchMock from '../hooks/use-fetch-mock'
import getMeta from '@/utils/meta'
import { bsVersionDecorator } from '../../../.storybook/utils/with-bootstrap-switcher'

const templateLinks = [
  {
    name: 'Journal articles',
    url: '/gallery/tagged/academic-journal',
  },
  {
    name: 'Books',
    url: '/gallery/tagged/book',
  },
  {
    name: 'Formal letters',
    url: '/gallery/tagged/formal-letter',
  },
  {
    name: 'Assignments',
    url: '/gallery/tagged/homework',
  },
  {
    name: 'Posters',
    url: '/gallery/tagged/poster',
  },
  {
    name: 'Presentations',
    url: '/gallery/tagged/presentation',
  },
  {
    name: 'Reports',
    url: '/gallery/tagged/report',
  },
  {
    name: 'CVs and résumés',
    url: '/gallery/tagged/cv',
  },
  {
    name: 'Theses',
    url: '/gallery/tagged/thesis',
  },
  {
    name: 'view_all',
    url: '/latex/templates',
  },
]

export const Success = () => {
  Object.assign(getMeta('ol-ExposedSettings'), {
    templateLinks,
  })

  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/new',
      {
        status: 200,
        body: {
          project_id: '123',
        },
      },
      { delay: 250 }
    )
  })

  return (
    <ProjectListProvider>
      <NewProjectButton id="new-project-button-story" />
    </ProjectListProvider>
  )
}

export const Error = () => {
  Object.assign(getMeta('ol-ExposedSettings'), {
    templateLinks,
  })

  useFetchMock(fetchMock => {
    fetchMock.post(
      'express:/project/new',
      {
        status: 400,
        body: {
          message: 'Something went horribly wrong!',
        },
      },
      { delay: 250 }
    )
  })

  return (
    <ProjectListProvider>
      <NewProjectButton id="new-project-button-story" />
    </ProjectListProvider>
  )
}

export default {
  title: 'Project List / New Project Button',
  component: NewProjectButton,
  argTypes: {
    ...bsVersionDecorator.argTypes,
  },
}
