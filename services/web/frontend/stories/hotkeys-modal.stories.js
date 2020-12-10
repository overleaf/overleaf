import React from 'react'

import HotkeysModalContent from '../js/features/hotkeys-modal/components/hotkeys-modal-content'

// NOTE: HotkeysModalContent is wrapped in modal classes, without modal behaviours
export const Basic = args => (
  <div className="modal-lg modal-dialog">
    <div className="modal-content">
      <HotkeysModalContent {...args} />
    </div>
  </div>
)

export default {
  title: 'Hotkeys Modal',
  component: HotkeysModalContent,
  args: {
    isMac: true,
    trackChangesVisible: true
  },
  argTypes: {
    handleHide: { action: 'handleHide' }
  }
}
