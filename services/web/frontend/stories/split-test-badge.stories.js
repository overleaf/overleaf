import SplitTestBadge from '../js/shared/components/split-test-badge'
import { ScopeDecorator } from './decorators/scope'
import { SplitTestContext } from '../js/shared/context/split-test-context'

const splitTestContextValue = {
  splitTestVariants: {
    'storybook-test': 'active',
  },
  splitTestInfo: {
    'storybook-test': {
      phase: 'alpha',
      badgeInfo: {
        url: '/alpha/participate',
        tooltipText: 'This is an alpha feature',
      },
    },
  },
}

export const Alpha = args => {
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
}

export const AlphaNotDisplayed = args => {
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
}

export const Beta = args => {
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
}

export const BetaNotDisplayed = args => {
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
}

export const Release = args => {
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
}

export const ReleaseNotDisplayed = args => {
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
}

export default {
  title: 'Shared / Components / Split Test Badge',
  component: SplitTestBadge,
  args: {
    splitTestName: 'storybook-test',
    displayOnVariants: ['active'],
  },
  decorators: [
    (Story, context) => (
      <SplitTestContext.Provider value={splitTestContextValue}>
        <Story />
      </SplitTestContext.Provider>
    ),
    ScopeDecorator,
  ],
}
