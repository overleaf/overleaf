import {
  screen,
  fireEvent,
  waitForElementToBeRemoved,
} from '@testing-library/react'
import fetchMock from 'fetch-mock'
import DictionaryModal from '../../../../../frontend/js/features/dictionary/components/dictionary-modal'
import { renderWithEditorContext } from '../../../helpers/render-with-context'

function setLearnedWords(words) {
  window.metaAttributesCache.set('ol-learnedWords', words)
  window.dispatchEvent(new CustomEvent('learnedWords:doreset'))
}
describe('<DictionaryModalContent />', function () {
  afterEach(function () {
    fetchMock.reset()
    setLearnedWords([])
  })

  it('list words', async function () {
    setLearnedWords(['foo', 'bar'])
    renderWithEditorContext(<DictionaryModal show handleHide={() => {}} />)
    screen.getByText('foo')
    screen.getByText('bar')
  })

  it('shows message when empty', async function () {
    setLearnedWords([])
    renderWithEditorContext(<DictionaryModal show handleHide={() => {}} />)
    screen.getByText('Your custom dictionary is empty.')
  })

  it('removes words', async function () {
    fetchMock.post('/spelling/unlearn', 200)
    setLearnedWords(['Foo', 'bar'])
    renderWithEditorContext(<DictionaryModal show handleHide={() => {}} />)
    screen.getByText('Foo')
    screen.getByText('bar')
    const [firstButton] = screen.getAllByRole('button', {
      name: 'Remove from dictionary',
    })
    fireEvent.click(firstButton)
    await waitForElementToBeRemoved(() => screen.getByText('bar'))
    screen.getByText('Foo')
  })

  it('handles errors', async function () {
    fetchMock.post('/spelling/unlearn', 500)
    setLearnedWords(['foo'])
    renderWithEditorContext(<DictionaryModal show handleHide={() => {}} />)
    screen.getByText('foo')
    const [firstButton] = screen.getAllByRole('button', {
      name: 'Remove from dictionary',
    })
    fireEvent.click(firstButton)
    await fetchMock.flush()
    screen.getByText('Sorry, something went wrong')
    screen.getByText('foo')
  })
})
