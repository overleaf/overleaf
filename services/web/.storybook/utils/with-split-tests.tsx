import type { Meta } from '@storybook/react'
import _ from 'lodash'
import { SplitTestContext } from '../../frontend/js/shared/context/split-test-context'

export const splitTestsArgTypes = {
  // to be able to use this utility, you need to add the argTypes for each split test in this object
  // Check the original implementation for an example: https://github.com/overleaf/internal/pull/17809
}

export const withSplitTests = (
  story: Meta,
  splitTests: (keyof typeof splitTestsArgTypes)[] = []
): Meta => {
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
