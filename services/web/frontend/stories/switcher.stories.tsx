import { Switcher, SwitcherItem } from '../js/shared/components/switcher'

export const Base = () => {
  return (
    <Switcher name="figure-width" defaultValue="0.5">
      <SwitcherItem value="0.25" label="¼ width" />
      <SwitcherItem value="0.5" label="½ width" />
      <SwitcherItem value="0.75" label="¾ width" />
      <SwitcherItem value="1.0" label="Full width" />
    </Switcher>
  )
}

export const Disabled = () => {
  return (
    <Switcher name="figure-width" defaultValue="0.5" disabled>
      <SwitcherItem value="0.25" label="¼ width" />
      <SwitcherItem value="0.5" label="½ width" />
      <SwitcherItem value="0.75" label="¾ width" />
      <SwitcherItem value="1.0" label="Full width" />
    </Switcher>
  )
}

export default {
  title: 'Shared / Components / Switcher',
  component: Switcher,
}
