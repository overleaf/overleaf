import { render, screen } from '@testing-library/react'
import { Filter } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { Tag } from '../../../../../app/src/Features/Tags/types'
import ProjectListTitle from '../../../../../frontend/js/features/project-list/components/title/project-list-title'

describe('<ProjectListTitle />', function () {
  type TestCase = {
    filter: Filter
    selectedTag: Tag | undefined
    expectedText: string
    selectedTagId: string | undefined
  }

  const testCases: Array<TestCase> = [
    // Filter, without tag
    {
      filter: 'all',
      selectedTag: undefined,
      expectedText: 'all projects',
      selectedTagId: undefined,
    },
    {
      filter: 'owned',
      selectedTag: undefined,
      expectedText: 'your projects',
      selectedTagId: undefined,
    },
    {
      filter: 'shared',
      selectedTag: undefined,
      expectedText: 'shared with you',
      selectedTagId: undefined,
    },
    {
      filter: 'archived',
      selectedTag: undefined,
      expectedText: 'archived projects',
      selectedTagId: undefined,
    },
    {
      filter: 'trashed',
      selectedTag: undefined,
      expectedText: 'trashed projects',
      selectedTagId: undefined,
    },
    // Tags
    {
      filter: 'all',
      selectedTag: undefined,
      expectedText: 'uncategorized',
      selectedTagId: 'uncategorized',
    },
    {
      filter: 'all',
      selectedTag: { _id: '', user_id: '', name: 'sometag' },
      expectedText: 'sometag',
      selectedTagId: '',
    },
    {
      filter: 'shared',
      selectedTag: { _id: '', user_id: '', name: 'othertag' },
      expectedText: 'othertag',
      selectedTagId: '',
    },
  ]

  for (const testCase of testCases) {
    it(`renders the title text for filter: ${testCase.filter}, tag: ${testCase?.selectedTag?.name}`, function () {
      render(
        <ProjectListTitle
          filter={testCase.filter}
          selectedTag={testCase.selectedTag}
          selectedTagId={testCase.selectedTagId}
        />
      )
      screen.getByText(new RegExp(testCase.expectedText, 'i'))
    })
  }
})
