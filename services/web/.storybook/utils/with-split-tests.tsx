import type { Meta } from '@storybook/react'
import _ from 'lodash'
import { SplitTestContext } from '@/shared/context/split-test-context'

export const defaultSplitTestsArgTypes = {
  // to be able to use this utility, you need to add the argTypes for each split test in this object
  // Check the original implementation for an example: https://github.com/overleaf/internal/pull/17809
}

export const withSplitTests = <ArgTypes = typeof defaultSplitTestsArgTypes,>(
  story: Meta,
  splitTests: (keyof ArgTypes)[] = [],
  /** @deprecated For demo purposes only. Add actual split tests in defaultSplitTestsArgTypes */
  _splitTestsArgTypes?: ArgTypes
): Meta => {
  const splitTestsArgTypes = _splitTestsArgTypes ?? defaultSplitTestsArgTypes
  return {
    ...story,
    argTypes: { ...story.argTypes, ..._.pick(splitTestsArgTypes, splitTests) },
    decorators: [
      (Story, { args }) => {
        const splitTestVariants = _.pick(args, splitTests)
        const value = { splitTestVariants, splitTestInfo: {} }
        return (
          <SplitTestContext.Provider value={value}>
            <Story />
          </SplitTestContext.Provider>
        )
      },
      ...(story.decorators
        ? Array.isArray(story.decorators)
          ? story.decorators
          : [story.decorators]
        : []),
    ],
  }
}
