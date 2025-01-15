import sinon from 'sinon'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect } from 'chai'
import SearchForm from '../../../../../frontend/js/features/project-list/components/search-form'
import * as eventTracking from '@/infrastructure/event-tracking'
import fetchMock from 'fetch-mock'
import { Filter } from '../../../../../frontend/js/features/project-list/context/project-list-context'
import { Tag } from '../../../../../app/src/Features/Tags/types'

describe('Project list search form', function () {
  let sendMBSpy: sinon.SinonSpy

  beforeEach(function () {
    sendMBSpy = sinon.spy(eventTracking, 'sendMB')
    fetchMock.reset()
  })

  afterEach(function () {
    fetchMock.reset()
    sendMBSpy.restore()
  })

  it('renders the search form', function () {
    const filter: Filter = 'all'
    const selectedTag = undefined
    render(
      <SearchForm
        inputValue=""
        setInputValue={() => {}}
        filter={filter}
        selectedTag={selectedTag}
      />
    )
    screen.getByRole('search')
    screen.getByRole('textbox', { name: /search in all projects/i })
  })

  it('calls clear text when clear button is clicked', function () {
    const filter: Filter = 'all'
    const selectedTag = undefined
    const setInputValueMock = sinon.stub()
    render(
      <SearchForm
        inputValue="abc"
        setInputValue={setInputValueMock}
        filter={filter}
        selectedTag={selectedTag}
      />
    )

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: /search in all projects/i,
    })

    expect(input.value).to.equal('abc')

    const clearBtn = screen.getByRole('button', { name: 'clear search' })
    fireEvent.click(clearBtn)

    expect(setInputValueMock).to.be.calledWith('')
  })

  it('changes text', function () {
    const setInputValueMock = sinon.stub()

    const filter: Filter = 'all'
    const selectedTag = undefined

    render(
      <SearchForm
        inputValue=""
        setInputValue={setInputValueMock}
        filter={filter}
        selectedTag={selectedTag}
      />
    )
    const input = screen.getByRole('textbox', {
      name: /search in all projects/i,
    })
    const value = 'abc'

    fireEvent.change(input, { target: { value } })

    expect(sendMBSpy).to.have.been.calledOnce
    expect(sendMBSpy).to.have.been.calledWith('project-list-page-interaction', {
      action: 'search',
      page: '/',
      isSmallDevice: true,
    })
    expect(setInputValueMock).to.be.calledWith(value)
  })

  type TestCase = {
    filter: Filter
    selectedTag: Tag | undefined
    expectedText: string
  }

  const placeholderTestCases: Array<TestCase> = [
    // Filter, without tag
    {
      filter: 'all',
      selectedTag: undefined,
      expectedText: 'search in all projects',
    },
    {
      filter: 'owned',
      selectedTag: undefined,
      expectedText: 'search in your projects',
    },
    {
      filter: 'shared',
      selectedTag: undefined,
      expectedText: 'search in projects shared with you',
    },
    {
      filter: 'archived',
      selectedTag: undefined,
      expectedText: 'search in archived projects',
    },
    {
      filter: 'trashed',
      selectedTag: undefined,
      expectedText: 'search in trashed projects',
    },
    // Tags
    {
      filter: 'all',
      selectedTag: { _id: '', user_id: '', name: 'sometag' },
      expectedText: 'search sometag',
    },
    {
      filter: 'shared',
      selectedTag: { _id: '', user_id: '', name: 'othertag' },
      expectedText: 'search othertag',
    },
  ]

  for (const testCase of placeholderTestCases) {
    it(`renders placeholder text for filter:${testCase.filter}, tag:${testCase?.selectedTag?.name}`, function () {
      render(
        <SearchForm
          inputValue=""
          setInputValue={() => {}}
          filter={testCase.filter}
          selectedTag={testCase.selectedTag}
        />
      )
      screen.getByRole('search')
      screen.getByRole('textbox', {
        name: new RegExp(testCase.expectedText, 'i'),
      })
    })
  }
})
