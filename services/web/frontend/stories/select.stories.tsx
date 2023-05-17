import { Select } from '../js/shared/components/select'

const items = [1, 2, 3, 4].map(index => ({
  key: index,
  value: `Demo item ${index}`,
  group: index >= 3 ? 'Large numbers' : undefined,
}))

export const Base = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      defaultText="Choose an item"
    />
  )
}

export const WithSubtitles = () => {
  return (
    <Select
      items={items}
      itemToString={x => String(x?.value)}
      itemToKey={x => String(x.key)}
      itemToSubtitle={x => x?.group ?? ''}
      defaultText="Choose an item"
    />
  )
}

export default {
  title: 'Shared / Components / Select',
  component: Select,
}
