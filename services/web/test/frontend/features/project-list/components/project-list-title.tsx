import { render, screen } from '@testing-library/react'
import { Filter } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import ProjectListTitle from '../../../../../frontend/js/features/project-list/components/title/project-list-title'

describe('<ProjectListTitle />', function () {
  type TestCase = {
    filter: Filter
    selectedTag: Tag | undefined
    expectedText: string
  }

  const testCases: Array<TestCase> = [
    // Filter, without tag
    {
      filter: 'all',
      selectedTag: undefined,
      expectedText: 'all projects',
    },
    {
      filter: 'owned',
      selectedTag: undefined,
      expectedText: 'your projects',
    },
    {
      filter: 'shared',
      selectedTag: undefined,
      expectedText: 'shared with you',
    },
    {
      filter: 'archived',
      selectedTag: undefined,
      expectedText: 'archived projects',
    },
    {
      filter: 'trashed',
      selectedTag: undefined,
      expectedText: 'trashed projects',
    },
    // Tags
    {
      filter: 'all',
      selectedTag: { _id: '', user_id: '', name: 'sometag' },
      expectedText: 'sometag',
    },
    {
      filter: 'shared',
      selectedTag: { _id: '', user_id: '', name: 'othertag' },
      expectedText: 'othertag',
    },
  ]

  for (const testCase of testCases) {
    it(`renders the title text for filter: ${testCase.filter}, tag: ${testCase?.selectedTag?.name}`, function () {
      render(
        <ProjectListTitle
          filter={testCase.filter}
          selectedTag={testCase.selectedTag}
        />
      )
      screen.getByText(new RegExp(testCase.expectedText, 'i'))
    })
  }
})
