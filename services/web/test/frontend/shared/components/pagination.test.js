import { expect } from 'chai'
import { render, screen } from '@testing-library/react'
import Pagination from '../../../../frontend/js/shared/components/pagination'

describe('<Pagination />', function () {
  it('renders with current page handled', async function () {
    render(
      <Pagination currentPage={6} totalPages={10} handlePageClick={() => {}} />
    )
    await screen.findByLabelText('Page 6, Current Page')
  })
  it('renders with nearby page buttons and prev/next button', async function () {
    render(
      <Pagination currentPage={2} totalPages={4} handlePageClick={() => {}} />
    )
    await screen.findByLabelText('Page 2, Current Page')
    await screen.findByLabelText('Go to page 1')
    await screen.findByLabelText('Go to page 3')
    await screen.findByLabelText('Go to page 4')
    await screen.findByLabelText('Go to Previous Page')
    await screen.findByLabelText('Go to Next Page')
  })
  it('does not render the prev button when expected', async function () {
    render(
      <Pagination currentPage={1} totalPages={2} handlePageClick={() => {}} />
    )
    await screen.findByLabelText('Page 1, Current Page')
    await screen.findByLabelText('Go to Next Page')
    expect(screen.queryByLabelText('Go to Prev Page')).to.be.null
  })
  it('does not render the next button when expected', async function () {
    render(
      <Pagination currentPage={2} totalPages={2} handlePageClick={() => {}} />
    )
    await screen.findByLabelText('Page 2, Current Page')
    await screen.findByLabelText('Go to Previous Page')
    expect(screen.queryByLabelText('Go to Next Page')).to.be.null
  })
  it('renders 1 ellipses when there are more pages than buttons and on first page', async function () {
    render(
      <Pagination currentPage={1} totalPages={10} handlePageClick={() => {}} />
    )
    const ellipses = await screen.findAllByText('…')
    expect(ellipses.length).to.equal(1)
  })
  it('renders 1 ellipses when on last page and there are more previous pages than buttons', async function () {
    render(
      <Pagination currentPage={10} totalPages={10} handlePageClick={() => {}} />
    )
    const ellipses = await screen.findAllByText('…')
    expect(ellipses.length).to.equal(1)
  })
  it('renders 2 ellipses when there are more pages than buttons', async function () {
    render(
      <Pagination currentPage={5} totalPages={10} handlePageClick={() => {}} />
    )
    const ellipses = await screen.findAllByText('…')
    expect(ellipses.length).to.equal(2)
  })
  it('only renders the number of page buttons set by maxOtherPageButtons', async function () {
    render(
      <Pagination currentPage={1} totalPages={100} handlePageClick={() => {}} />
    )
    const items = document.querySelectorAll('button')
    expect(items.length).to.equal(6) // 5 page buttons + next button
  })
})
