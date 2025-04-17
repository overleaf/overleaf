import { screen } from '@testing-library/react'
import { expect } from 'chai'
import sinon from 'sinon'
import fetchMock from 'fetch-mock'
import { renderWithEditorContext } from '../../../helpers/render-with-context'
import WordCountModal from '../../../../../frontend/js/features/word-count-modal/components/word-count-modal'

describe('<WordCountModal />', function () {
  afterEach(function () {
    fetchMock.removeRoutes().clearHistory()
  })

  const contextProps = {
    projectId: 'project-1',
    clsiServerId: 'clsi-server-1',
  }

  it('renders the translated modal title', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return { status: 200, body: { texcount: { messages: 'This is a test' } } }
    })

    const handleHide = sinon.stub()

    renderWithEditorContext(
      <WordCountModal show handleHide={handleHide} />,
      contextProps
    )

    await screen.findByText('Word Count')
  })

  it('renders a loading message when loading', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return { status: 200, body: { texcount: { messages: 'This is a test' } } }
    })

    const handleHide = sinon.stub()

    renderWithEditorContext(
      <WordCountModal show handleHide={handleHide} />,
      contextProps
    )

    await screen.findByText('Loading…')

    await screen.findByText('This is a test')
  })

  it('renders an error message and hides loading message on error', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', 500)

    const handleHide = sinon.stub()

    renderWithEditorContext(
      <WordCountModal show handleHide={handleHide} />,
      contextProps
    )

    await screen.findByText('Sorry, something went wrong')

    expect(screen.queryByText(/Loading/)).to.not.exist
  })

  it('displays messages', async function () {
    fetchMock.get('express:/project/:projectId/wordcount', () => {
      return {
        status: 200,
        body: {
          texcount: {
            messages: 'This is a test',
          },
        },
      }
    })

    const handleHide = sinon.stub()

    renderWithEditorContext(
      <WordCountModal show handleHide={handleHide} />,
      contextProps
    )

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
            headers: 400,
          },
        },
      }
    })

    const handleHide = sinon.stub()

    renderWithEditorContext(
      <WordCountModal show handleHide={handleHide} />,
      contextProps
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
