import type { ComponentType } from 'react'
import _ from 'lodash'
import { SplitTestContext } from '@/shared/context/split-test-context'

export const defaultSplitTestsArgTypes = {
  // to be able to use this utility, you need to add the argTypes for each split test in this object
  // Check the original implementation for an example: https://github.com/overleaf/internal/pull/17809
  'cancel-loss-messaging': {
    description:
      'Show plan-specific losses on the cancel confirmation step (#35765)',
    control: { type: 'radio' as const },
    options: ['default', 'enabled'],
  },
}

type StoryConfig = {
  argTypes?: Record<string, unknown>
  decorators?: unknown
}

type Decorator = (
  Story: ComponentType,
  context: { args: Record<string, unknown> }
) => React.JSX.Element

export const withSplitTests = <
  T extends object,
  ArgTypes = typeof defaultSplitTestsArgTypes,
>(
  story: T & StoryConfig,
  splitTests: (keyof ArgTypes)[] = [],
  /** @deprecated For demo purposes only. Add actual split tests in defaultSplitTestsArgTypes */
  _splitTestsArgTypes?: ArgTypes
): T & { argTypes: Record<string, unknown>; decorators: Decorator[] } => {
  const splitTestsArgTypes = _splitTestsArgTypes ?? defaultSplitTestsArgTypes
  const decorators: Decorator[] = [
    (Story, { args }) => {
      const splitTestVariants = _.pick(args, splitTests) as Record<
        string,
        string
      >
      const value = { splitTestVariants, splitTestInfo: {} }
      return (
        <SplitTestContext.Provider value={value}>
          <Story />
        </SplitTestContext.Provider>
      )
    },
    ...((story.decorators
      ? Array.isArray(story.decorators)
        ? story.decorators
        : [story.decorators]
      : []) as Decorator[]),
  ]
  return {
    ...story,
    argTypes: { ...story.argTypes, ..._.pick(splitTestsArgTypes, splitTests) },
    decorators,
  }
}
