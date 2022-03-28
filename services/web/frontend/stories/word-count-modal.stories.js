import useFetchMock from './hooks/use-fetch-mock'
import { withContextRoot } from './utils/with-context-root'
import WordCountModal from '../js/features/word-count-modal/components/word-count-modal'

const counts = {
  headers: 4,
  mathDisplay: 40,
  mathInline: 400,
  textWords: 4000,
}

const messages = [
  'Lorem ipsum dolor sit amet.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
].join('\n')

const project = {
  _id: 'project-id',
  name: 'A Project',
}

export const WordCount = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 200, body: { texcount: counts } },
      { delay: 500 }
    )
  })

  return withContextRoot(<WordCountModal {...args} />, { project })
}

export const WordCountWithMessages = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 200, body: { texcount: { ...counts, messages } } },
      { delay: 500 }
    )
  })

  return withContextRoot(<WordCountModal {...args} />, { project })
}

export const ErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 500 },
      { delay: 500 }
    )
  })

  return withContextRoot(<WordCountModal {...args} />, { project })
}

export default {
  title: 'Editor / Modals / Word Count',
  component: WordCountModal,
  args: {
    show: true,
  },
}
