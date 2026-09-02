import type { Decorator } from '@storybook/react-webpack5'

export const themedDecorator: Decorator = Story => (
  <div
    style={{
      backgroundColor: 'var(--bg-primary-themed)',
      padding: 'var(--spacing-04)',
    }}
  >
    <Story />
  </div>
)
