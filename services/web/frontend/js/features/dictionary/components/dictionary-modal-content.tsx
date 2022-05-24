import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Modal } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import Tooltip from '../../../shared/components/tooltip'
import useAsync from '../../../shared/hooks/use-async'
import { postJSON } from '../../../infrastructure/fetch-json'
import ignoredWords from '../ignored-words'

type DictionaryModalContentProps = {
  handleHide: () => void
}

export default function DictionaryModalContent({
  handleHide,
}: DictionaryModalContentProps) {
  const { t } = useTranslation()

  const { isError, runAsync } = useAsync()

  const handleRemove = useCallback(
    word => {
      ignoredWords.remove(word)
      runAsync(
        postJSON('/spelling/unlearn', {
          body: {
            word,
          },
        })
      ).catch(console.error)
    },
    [runAsync]
  )

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('edit_dictionary')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {isError ? (
          <Alert bsStyle="danger">{t('generic_something_went_wrong')}</Alert>
        ) : null}

        {ignoredWords.learnedWords?.size > 0 ? (
          <ul className="list-unstyled">
            {[...ignoredWords.learnedWords].sort().map(learnedWord => (
              <li key={learnedWord}>
                <Tooltip
                  id={`tooltip-remove-learned-word-${learnedWord}`}
                  description={t('edit_dictionary_remove')}
                >
                  <Button
                    className="btn-link action-btn"
                    onClick={() => handleRemove(learnedWord)}
                  >
                    <Icon
                      type="trash-o"
                      accessibilityLabel={t('edit_dictionary_remove')}
                    />
                  </Button>
                </Tooltip>
                {learnedWord}
              </li>
            ))}
          </ul>
        ) : (
          <i>{t('edit_dictionary_empty')}</i>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleHide}>{t('done')}</Button>
      </Modal.Footer>
    </>
  )
}
