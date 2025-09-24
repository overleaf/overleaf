import type { Meta, StoryObj } from '@storybook/react'
import SplitTestBadge from '../../js/shared/components/split-test-badge'
import { SplitTestContext } from '../../js/shared/context/split-test-context'

type Story = StoryObj<typeof SplitTestBadge>

const splitTestContextValue = {
  splitTestVariants: {} as Record<string, string>,
  splitTestInfo: {} as Record<string, any>,
}

export const Alpha: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'active',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'alpha',
        badgeInfo: {
          url: '/alpha/participate',
          tooltipText: 'This is an alpha feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

export const AlphaNotDisplayed: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'default',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'alpha',
        badgeInfo: {
          url: '/alpha/participate',
          tooltipText: 'This is an alpha feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

export const Beta: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'active',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'beta',
        badgeInfo: {
          url: '/beta/participate',
          tooltipText: 'This is a beta feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

export const BetaNotDisplayed: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'default',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'beta',
        badgeInfo: {
          url: '/beta/participate',
          tooltipText: 'This is a beta feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

export const Release: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'active',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'release',
        badgeInfo: {
          url: '/feedback/form',
          tooltipText: 'This is a new feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

export const ReleaseNotDisplayed: Story = {
  render: args => {
    splitTestContextValue.splitTestVariants = {
      'storybook-test': 'default',
    }
    splitTestContextValue.splitTestInfo = {
      'storybook-test': {
        phase: 'release',
        badgeInfo: {
          url: '/feedback/form',
          tooltipText: 'This is a new feature',
        },
      },
    }

    return <SplitTestBadge {...args} />
  },
}

const meta: Meta<typeof SplitTestBadge> = {
  title: 'Shared / Components / Split Test Badge',
  component: SplitTestBadge,
  parameters: {
    controls: {
      include: ['splitTestName', 'tooltip'],
    },
  },
  argTypes: {
    splitTestName: { control: 'text' },
    tooltip: { control: 'text' },
  },
  args: {
    splitTestName: 'storybook-test',
    displayOnVariants: ['active'],
  },
  decorators: [
    Story => (
      <SplitTestContext.Provider value={splitTestContextValue}>
        <Story />
      </SplitTestContext.Provider>
    ),
  ],
}

export default meta
