import { Meta, StoryObj } from '@storybook/react'
import WordCountModal from '@/features/word-count-modal/components/word-count-modal'
import { ScopeDecorator } from './decorators/scope'
import useFetchMock from './hooks/use-fetch-mock'

export default {
  title: 'Editor / Modals / Word Count',
  component: WordCountModal,
  args: {
    show: true,
  },
  argTypes: {
    handleHide: {
      action: 'close modal',
    },
  },
  decorators: [Story => ScopeDecorator(Story)],
} satisfies Meta

type Story = StoryObj<typeof WordCountModal>

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

export const WordCount: Story = {
  decorators: [
    Story => {
      useFetchMock(fetchMock => {
        fetchMock.get(
          'express:/project/:projectId/wordcount',
          { status: 200, body: { texcount: counts } },
          { delay: 500 }
        )
      })

      return <Story />
    },
  ],
}

export const WordCountWithMessages: Story = {
  decorators: [
    Story => {
      useFetchMock(fetchMock => {
        fetchMock.get(
          'express:/project/:projectId/wordcount',
          { status: 200, body: { texcount: { ...counts, messages } } },
          { delay: 500 }
        )
      })

      return <Story />
    },
  ],
}

export const ErrorResponse: Story = {
  decorators: [
    Story => {
      useFetchMock(fetchMock => {
        fetchMock.get(
          'express:/project/:projectId/wordcount',
          { status: 500 },
          { delay: 500 }
        )
      })

      return <Story />
    },
  ],
}
