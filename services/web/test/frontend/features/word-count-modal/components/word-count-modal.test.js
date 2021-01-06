import React from 'react'
import { render, screen } from '@testing-library/react'
import WordCountModalContent from '../../../../../frontend/js/features/word-count-modal/components/word-count-modal-content'
import { expect } from 'chai'

const handleHide = () => {
  // closed
}

describe('<WordCountModalContent />', function() {
  it('renders the translated modal title', async function() {
    render(<WordCountModalContent handleHide={handleHide} loading={false} />)

    await screen.findByText('Word Count')

    expect(screen.queryByText(/Loading/)).to.not.exist
  })

  it('renders a loading message when loading', async function() {
    render(<WordCountModalContent handleHide={handleHide} loading />)

    await screen.findByText('Loading')
  })

  it('renders an error message and hides loading message on error', async function() {
    render(<WordCountModalContent handleHide={handleHide} loading error />)

    await screen.findByText('Sorry, something went wrong')

    expect(screen.queryByText(/Loading/)).to.not.exist
  })

  it('displays messages', async function() {
    render(
      <WordCountModalContent
        handleHide={handleHide}
        loading={false}
        data={{
          messages: 'This is a test'
        }}
      />
    )

    await screen.findByText('This is a test')
  })

  it('displays counts data', async function() {
    render(
      <WordCountModalContent
        handleHide={handleHide}
        loading={false}
        data={{
          textWords: 100,
          mathDisplay: 200,
          mathInline: 300,
          headers: 400
        }}
      />
    )

    await screen.findByText((content, element) =>
      element.textContent.trim().match(/^Total Words\s*:\s*100$/)
    )
    await screen.findByText((content, element) =>
      element.textContent.trim().match(/^Math Display\s*:\s*200$/)
    )
    await screen.findByText((content, element) =>
      element.textContent.trim().match(/^Math Inline\s*:\s*300$/)
    )
    await screen.findByText((content, element) =>
      element.textContent.trim().match(/^Headers\s*:\s*400$/)
    )
  })
})
