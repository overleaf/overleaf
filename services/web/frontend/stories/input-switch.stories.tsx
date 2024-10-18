import OLFormSwitch from '@/features/ui/components/ol/ol-form-switch'
import { bsVersionDecorator } from '../../.storybook/utils/with-bootstrap-switcher'
import { disableControlsOf } from './utils/arg-types'

export const Unchecked = () => {
  return <OLFormSwitch onChange={() => {}} checked={false} />
}

export const UncheckedDisabled = () => {
  return <OLFormSwitch onChange={() => {}} checked={false} disabled />
}

export const Checked = () => {
  return <OLFormSwitch onChange={() => {}} checked />
}

export const CheckedDisabled = () => {
  return <OLFormSwitch onChange={() => {}} checked disabled />
}

export default {
  title: 'Shared / Components / Input Switch',
  component: OLFormSwitch,
  argTypes: {
    ...bsVersionDecorator.argTypes,
    ...disableControlsOf('inputRef', 'bs3Props'),
  },
  args: {
    ...bsVersionDecorator.args,
  },
}
