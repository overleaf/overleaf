import { ComponentProps } from 'react'
import HotkeysModal from '../js/features/hotkeys-modal/components/hotkeys-modal'

type HotkeysModalProps = ComponentProps<typeof HotkeysModal>

export const ReviewEnabled = (args: HotkeysModalProps) => {
  return <HotkeysModal {...args} />
}

export const ReviewDisabled = (args: HotkeysModalProps) => {
  return <HotkeysModal {...args} trackChangesVisible={false} />
}

export const MacModifier = (args: HotkeysModalProps) => {
  return <HotkeysModal {...args} isMac />
}

export default {
  title: 'Editor / Modals / Hotkeys',
  component: HotkeysModal,
  args: {
    animation: false,
    show: true,
    isMac: false,
    trackChangesVisible: true,
  },
  argTypes: {
    handleHide: { action: 'handleHide' },
  },
}
