import React from 'react'

import OutlinePane from '../js/features/outline/components/outline-pane'

export const Basic = args => <OutlinePane {...args} />
Basic.args = {
  outline: [{ line: 1, title: 'Hello', level: 1 }]
}

export const Nested = args => <OutlinePane {...args} />
Nested.args = {
  outline: [
    {
      line: 1,
      title: 'Section',
      level: 1,
      children: [
        {
          line: 2,
          title: 'Subsection',
          level: 2,
          children: [
            {
              line: 3,
              title: 'Subsubsection',
              level: 3
            }
          ]
        }
      ]
    }
  ]
}

export const NoSections = args => <OutlinePane {...args} />
NoSections.args = {}

export const NonTexFile = args => <OutlinePane {...args} />
NonTexFile.args = {
  isTexFile: false
}

export default {
  title: 'Outline',
  component: OutlinePane,
  argTypes: {
    jumpToLine: { action: 'jumpToLine' }
  },
  args: {
    projectId: '1234',
    eventTracking: { sendMB: () => {} },
    isTexFile: true,
    outline: [],
    jumpToLine: () => {},
    onToggle: () => {}
  }
}
