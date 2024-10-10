import useFetchMock from './hooks/use-fetch-mock'
import WordCountModal from '../js/features/word-count-modal/components/word-count-modal'
import { ScopeDecorator } from './decorators/scope'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

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

export const WordCount = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 200, body: { texcount: counts } },
      { delay: 500 }
    )
  })

  return <WordCountModal {...args} />
}

export const WordCountWithMessages = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 200, body: { texcount: { ...counts, messages } } },
      { delay: 500 }
    )
  })

  return <WordCountModal {...args} />
}

export const ErrorResponse = args => {
  useFetchMock(fetchMock => {
    fetchMock.get(
      'express:/project/:projectId/wordcount',
      { status: 500 },
      { delay: 500 }
    )
  })

  return <WordCountModal {...args} />
}

export default {
  title: 'Editor / Modals / Word Count',
  component: WordCountModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: { action: 'close modal' },
    ...bsVersionDecorator.argTypes,
  },
  decorators: [ScopeDecorator],
}
