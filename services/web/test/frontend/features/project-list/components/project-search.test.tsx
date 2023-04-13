import sinon from 'sinon'
import { render, screen, fireEvent } from '@testing-library/react'
import { expect } from 'chai'
import SearchForm from '../../../../../frontend/js/features/project-list/components/search-form'
import * as eventTracking from '../../../../../frontend/js/infrastructure/event-tracking'
import fetchMock from 'fetch-mock'

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

    render(<SearchForm inputValue="" setInputValue={setInputValueMock} />)
    const input = screen.getByRole('textbox', { name: /search projects/i })
    const value = 'abc'

    fireEvent.change(input, { target: { value } })

    expect(sendMBSpy).to.have.been.calledOnce
    expect(sendMBSpy).to.have.been.calledWith('project-list-page-interaction', {
      action: 'search',
      page: '/',
    })
    expect(setInputValueMock).to.be.calledWith(value)
  })
})
