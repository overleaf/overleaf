import React from 'react'

import WordCountModalContent from '../js/features/word-count-modal/components/word-count-modal-content'

export const Basic = args => {
  const data = {
    headers: 4,
    mathDisplay: 40,
    mathInline: 400,
    textWords: 4000
  }

  return <WordCountModalContent {...args} data={data} />
}

export const Loading = args => {
  return <WordCountModalContent {...args} loading />
}

export const LoadingError = args => {
  return <WordCountModalContent {...args} error />
}

export const Messages = args => {
  const messages = [
    'Lorem ipsum dolor sit amet.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  ].join('\n')

  return <WordCountModalContent {...args} data={{ messages }} />
}

export default {
  title: 'Word Count Modal / Content',
  component: WordCountModalContent,
  args: {
    animation: false,
    show: true,
    error: false,
    loading: false
  },
  argTypes: {
    handleHide: { action: 'hide' }
  }
}
