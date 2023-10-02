import Switch from '../js/shared/components/switch'

export const Unchecked = () => {
  return <Switch onChange={() => {}} checked={false} />
}

export const Checked = () => {
  return <Switch onChange={() => {}} checked />
}

export default {
  title: 'Shared / Components / Switch',
  component: Switch,
}
