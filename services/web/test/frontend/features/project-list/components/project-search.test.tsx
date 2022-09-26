import sinon from 'sinon'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect } from 'chai'
import SearchForm from '../../../../../frontend/js/features/project-list/components/search-form'
import * as eventTracking from '../../../../../frontend/js/infrastructure/event-tracking'
import fetchMock from 'fetch-mock'

describe('Project list search form', function () {
  beforeEach(function () {
    fetchMock.reset()
  })

  afterEach(function () {
    fetchMock.reset()
  })

  it('renders the search form', function () {
    render(<SearchForm inputValue="" setInputValue={() => {}} />)
    screen.getByRole('search')
    screen.getByRole('textbox', { name: /search projects/i })
  })

  it('calls clear text when clear button is clicked', function () {
    const setInputValueMock = sinon.stub()
    render(<SearchForm inputValue="abc" setInputValue={setInputValueMock} />)

    const input = screen.getByRole<HTMLInputElement>('textbox', {
      name: /search projects/i,
    })

    expect(input.value).to.equal('abc')

    const clearBtn = screen.getByRole('button', { name: 'clear search' })
    fireEvent.click(clearBtn)

    expect(setInputValueMock).to.be.calledWith('')
  })

  it('changes text', function () {
    const setInputValueMock = sinon.stub()
    const sendSpy = sinon.spy(eventTracking, 'send')

    render(<SearchForm inputValue="" setInputValue={setInputValueMock} />)
    const input = screen.getByRole('textbox', { name: /search projects/i })
    const value = 'abc'

    fireEvent.change(input, { target: { value } })
    expect(sendSpy).to.be.calledOnceWith(
      'project-list-page-interaction',
      'project-search',
      'keydown'
    )
    expect(setInputValueMock).to.be.calledWith(value)
    sendSpy.restore()
  })
})
