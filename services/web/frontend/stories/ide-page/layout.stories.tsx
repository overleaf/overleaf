import LayoutWithPlaceholders from '@/features/ide-react/components/layout/layout-with-placeholders'

export default {
  title: 'Editor / Page Layout',
  component: LayoutWithPlaceholders,
  decorators: [
    (Story: any) => (
      <div
        style={{ position: 'absolute', inset: '1em', border: 'solid #ccc 1px' }}
      >
        <Story />
      </div>
    ),
  ],
}

export const Persisted = {
  args: {
    shouldPersistLayout: true,
  },
}

export const Unpersisted = {
  args: {
    shouldPersistLayout: false,
  },
}
