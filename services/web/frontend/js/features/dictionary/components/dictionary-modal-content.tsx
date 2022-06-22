import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Modal } from 'react-bootstrap'
import Icon from '../../../shared/components/icon'
import Tooltip from '../../../shared/components/tooltip'
import useAsync from '../../../shared/hooks/use-async'
import { postJSON } from '../../../infrastructure/fetch-json'
import ignoredWords from '../ignored-words'
import BetaBadge from '../../../shared/components/beta-badge'

type DictionaryModalContentProps = {
  handleHide: () => void
}

const wordsSortFunction = (a: string, b: string) => a.localeCompare(b)

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

  const betaBadgeTooltipProps = useMemo(() => {
    return {
      id: 'dictionary-modal-tooltip',
      placement: 'bottom',
      className: 'tooltip-wide',
      text: (
        <>
          We are testing the dictionary manager.
          <br />
          Click to give feedback
        </>
      ),
    }
  }, [])

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>
          {t('edit_dictionary')}{' '}
          <BetaBadge
            tooltip={betaBadgeTooltipProps}
            url="https://forms.gle/8cLBEW6HU9mDKBPX9"
            phase="release"
          />
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {isError ? (
          <Alert bsStyle="danger">{t('generic_something_went_wrong')}</Alert>
        ) : null}

        {ignoredWords.learnedWords?.size > 0 ? (
          <ul className="list-unstyled dictionary-entries-list">
            {[...ignoredWords.learnedWords]
              .sort(wordsSortFunction)
              .map(learnedWord => (
                <li key={learnedWord} className="dictionary-entry">
                  <span className="dictionary-entry-name">{learnedWord}</span>
                  <Tooltip
                    id={`tooltip-remove-learned-word-${learnedWord}`}
                    description={t('edit_dictionary_remove')}
                    overlayProps={{ delay: 0 }}
                  >
                    <Button
                      bsStyle="danger"
                      bsSize="xs"
                      onClick={() => handleRemove(learnedWord)}
                    >
                      <Icon
                        type="trash-o"
                        accessibilityLabel={t('edit_dictionary_remove')}
                      />
                    </Button>
                  </Tooltip>
                </li>
              ))}
          </ul>
        ) : (
          <p className="dictionary-empty-body text-center">
            <i>{t('edit_dictionary_empty')}</i>
          </p>
        )}
      </Modal.Body>

      <Modal.Footer>
        <Button onClick={handleHide}>{t('done')}</Button>
      </Modal.Footer>
    </>
  )
}
