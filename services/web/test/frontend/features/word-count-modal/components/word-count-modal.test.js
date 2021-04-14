import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import WordCountModal from '../../../../../frontend/js/features/word-count-modal/components/word-count-modal'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'

describe('<WordCountModal />', function () {
  afterEach(function () {
    fetchMock.reset()
    cleanup()
  })

  const modalProps = {
    projectId: 'project-1',
    clsiServerId: 'clsi-server-1',
    show: true,
    handleHide: sinon.stub()
  }

  it('renders the translated modal title', async function () {
    render(<WordCountModal {...modalProps} />)

    await screen.findByText('Word Count')
  })

  it('renders a loading message when loading', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return { status: 200, body: { texcount: {} } }
    })

    render(<WordCountModal {...modalProps} />)

    await screen.findByText('Loading…')
  })

  it('renders an error message and hides loading message on error', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', 500)

    render(<WordCountModal {...modalProps} />)

    await screen.findByText('Sorry, something went wrong')

    expect(screen.queryByText(/Loading/)).to.not.exist
  })

  it('displays messages', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return {
        status: 200,
        body: {
          texcount: {
            messages: 'This is a test'
          }
        }
      }
    })

    render(<WordCountModal {...modalProps} />)

    await screen.findByText('This is a test')
  })

  it('displays counts data', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return {
        status: 200,
        body: {
          texcount: {
            textWords: 100,
            mathDisplay: 200,
            mathInline: 300,
            headers: 400
          }
        }
      }
    })

    render(<WordCountModal {...modalProps} />)

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
