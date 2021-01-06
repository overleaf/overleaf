import React from 'react'

import WordCountModalContent from '../js/features/word-count-modal/components/word-count-modal-content'

// NOTE: WordCountModalContent is wrapped in modal classes, without modal behaviours

export const Loading = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <WordCountModalContent {...args} />
    </div>
  </div>
)
Loading.args = {
  loading: true,
  error: false
}

export const LoadingError = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <WordCountModalContent {...args} />
    </div>
  </div>
)
LoadingError.args = {
  loading: false,
  error: true
}

export const Loaded = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <WordCountModalContent {...args} />
    </div>
  </div>
)
Loaded.args = {
  loading: false,
  error: false,
  data: {
    headers: 4,
    mathDisplay: 40,
    mathInline: 400,
    textWords: 4000
  }
}

export const Messages = args => (
  <div className="modal-dialog">
    <div className="modal-content">
      <WordCountModalContent {...args} />
    </div>
  </div>
)
Messages.args = {
  loading: false,
  error: false,
  data: {
    messages: [
      'Lorem ipsum dolor sit amet.',
      'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
    ].join('\n'),
    headers: 4,
    mathDisplay: 40,
    mathInline: 400,
    textWords: 4000
  }
}

export default {
  title: 'Word Count Modal',
  component: WordCountModalContent,
  argTypes: {
    handleHide: { action: 'handleHide' }
  }
}
