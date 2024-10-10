import HotkeysModal from '../js/features/hotkeys-modal/components/hotkeys-modal'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'

export const ReviewEnabled = args => {
  return <HotkeysModal {...args} />
}

export const ReviewDisabled = args => {
  return <HotkeysModal {...args} trackChangesVisible={false} />
}

export const MacModifier = args => {
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
    ...bsVersionDecorator.argTypes,
  },
}
