import OLFormSwitch from '@/shared/components/ol/ol-form-switch'
import { figmaDesignUrl } from '../../../.storybook/utils/figma-design-url'

type Args = React.ComponentProps<typeof OLFormSwitch>

export const Unchecked = (args: Args) => {
  return <OLFormSwitch onChange={() => {}} checked={false} {...args} />
}

export const UncheckedDisabled = (args: Args) => {
  return <OLFormSwitch onChange={() => {}} checked={false} disabled {...args} />
}

export const Checked = (args: Args) => {
  return <OLFormSwitch onChange={() => {}} checked {...args} />
}

export const CheckedDisabled = (args: Args) => {
  return <OLFormSwitch onChange={() => {}} checked disabled {...args} />
}

export default {
  title: 'Shared / Components / Input Switch',
  component: OLFormSwitch,
  args: {
    checked: false,
    disabled: false,
  },
  parameters: {
    controls: {
      include: ['checked', 'disabled'],
    },
    ...figmaDesignUrl(
      'https://www.figma.com/design/V7Ogph1Ocs4ux2A4WMNAh7/Overleaf---Components?node-id=3489-139487&m=dev'
    ),
  },
}
