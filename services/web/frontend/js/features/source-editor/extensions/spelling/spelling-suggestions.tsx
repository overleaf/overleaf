import {
  FC,
  MouseEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { SpellChecker, Word } from './spellchecker'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import classnames from 'classnames'
import { sendMB } from '@/infrastructure/event-tracking'
import { SpellingSuggestionsLanguage } from './spelling-suggestions-language'
import { captureException } from '@/infrastructure/error-reporter'
import { debugConsole } from '@/utils/debugging'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { SpellCheckLanguage } from '../../../../../../types/project-settings'
import { Dropdown } from 'react-bootstrap-5'

const ITEMS_TO_SHOW = 8

// (index % length) that works for negative index
const wrapArrayIndex = (index: number, length: number) =>
  ((index % length) + length) % length

type SpellingSuggestionsProps = {
  word: Word
  spellCheckLanguage?: string
  spellChecker?: SpellChecker | null
  handleClose: () => void
  handleLearnWord: () => void
  handleCorrectWord: (text: string) => void
}

export const SpellingSuggestions: FC<SpellingSuggestionsProps> = ({
  word,
  spellCheckLanguage,
  spellChecker,
  handleClose,
  handleLearnWord,
  handleCorrectWord,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([])

  const [waiting, setWaiting] = useState(true)

  useEffect(() => {
    spellChecker
      ?.suggest(word.text)
      .then(result => {
        setSuggestions(result.suggestions.slice(0, ITEMS_TO_SHOW))
        setWaiting(false)
        sendMB('spelling-suggestion-shown', {
          language: spellCheckLanguage,
          count: result.suggestions.length,
          // word: transaction.state.sliceDoc(mark.from, mark.to),
        })
      })
      .catch(error => {
        captureException(error, {
          tags: { ol_spell_check_language: spellCheckLanguage },
        })
        debugConsole.error(error)
      })
  }, [word, spellChecker, spellCheckLanguage])

  const language = useMemo(() => {
    if (spellCheckLanguage) {
      return (getMeta('ol-languages') ?? []).find(
        item => item.code === spellCheckLanguage
      )
    }
  }, [spellCheckLanguage])

  if (!language) {
    return null
  }

  const innerProps = {
    suggestions,
    waiting,
    handleClose,
    handleCorrectWord,
    handleLearnWord,
    language,
  }

  return (
    <BootstrapVersionSwitcher
      bs3={<B3SpellingSuggestions {...innerProps} />}
      bs5={<B5SpellingSuggestions {...innerProps} />}
    />
  )
}

type SpellingSuggestionsInnerProps = {
  suggestions: string[]
  waiting: boolean
  handleClose: () => void
  handleCorrectWord: (text: string) => void
  handleLearnWord: () => void
  language: SpellCheckLanguage
}

const B3SpellingSuggestions: FC<SpellingSuggestionsInnerProps> = ({
  suggestions,
  waiting,
  language,
  handleClose,
  handleCorrectWord,
  handleLearnWord,
}) => {
  const { t } = useTranslation()

  const [selectedIndex, setSelectedIndex] = useState(0)

  const itemsLength = suggestions.length + 1

  return (
    <ul
      className={classnames('dropdown-menu', 'dropdown-menu-unpositioned', {
        hidden: waiting,
      })}
      tabIndex={0}
      role="menu"
      onKeyDown={event => {
        switch (event.code) {
          case 'ArrowDown':
            setSelectedIndex(value => wrapArrayIndex(value + 1, itemsLength))
            break

          case 'ArrowUp':
            setSelectedIndex(value => wrapArrayIndex(value - 1, itemsLength))
            break

          case 'Escape':
          case 'Tab':
            event.preventDefault()
            handleClose()
            break
        }
      }}
    >
      {Array.isArray(suggestions) && (
        <>
          {suggestions.map((suggestion, index) => (
            <BS3ListItem
              key={suggestion}
              content={suggestion}
              selected={index === selectedIndex}
              handleClick={event => {
                event.preventDefault()
                handleCorrectWord(suggestion)
              }}
            />
          ))}
          {suggestions.length > 0 && <li className="divider" />}
        </>
      )}
      <BS3ListItem
        content={t('add_to_dictionary')}
        selected={selectedIndex === itemsLength - 1}
        handleClick={event => {
          event.preventDefault()
          handleLearnWord()
        }}
      />

      <li className="divider" />
      <li role="menuitem">
        <SpellingSuggestionsLanguage
          language={language}
          handleClose={handleClose}
        />
      </li>
    </ul>
  )
}

const BS3ListItem: FC<{
  content: string
  selected: boolean
  handleClick: MouseEventHandler<HTMLButtonElement>
}> = ({ content, selected, handleClick }) => {
  const handleListItem = useCallback(
    (element: HTMLElement | null) => {
      if (element && selected) {
        window.setTimeout(() => {
          element.focus()
        })
      }
    },
    [selected]
  )

  return (
    <li role="menuitem">
      <button
        className="btn-link text-left dropdown-menu-button"
        onClick={handleClick}
        ref={handleListItem}
      >
        {content}
      </button>
    </li>
  )
}

const B5SpellingSuggestions: FC<SpellingSuggestionsInnerProps> = ({
  suggestions,
  waiting,
  language,
  handleClose,
  handleCorrectWord,
  handleLearnWord,
}) => {
  const { t } = useTranslation()
  return (
    <Dropdown>
      <Dropdown.Menu
        className={classnames('dropdown-menu', 'dropdown-menu-unpositioned', {
          hidden: waiting,
        })}
        show={!waiting}
        tabIndex={0}
        role="menu"
        onKeyDown={event => {
          switch (event.code) {
            case 'Escape':
            case 'Tab':
              event.preventDefault()
              handleClose()
              break
          }
        }}
      >
        {Array.isArray(suggestions) &&
          suggestions.map((suggestion, index) => (
            <BS5ListItem
              key={suggestion}
              content={suggestion}
              handleClick={event => {
                event.preventDefault()
                handleCorrectWord(suggestion)
              }}
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={index === 0}
            />
          ))}
        {suggestions?.length > 0 && <Dropdown.Divider />}
        <BS5ListItem
          content={t('add_to_dictionary')}
          handleClick={event => {
            event.preventDefault()
            handleLearnWord()
          }}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={suggestions?.length === 0}
        />

        <Dropdown.Divider />
        <SpellingSuggestionsLanguage
          language={language}
          handleClose={handleClose}
        />
      </Dropdown.Menu>
    </Dropdown>
  )
}

const BS5ListItem: FC<{
  content: string
  handleClick: MouseEventHandler<HTMLButtonElement>
  autoFocus?: boolean
}> = ({ content, handleClick, autoFocus }) => {
  const handleListItem = useCallback(
    (node: HTMLElement | null) => {
      if (node && autoFocus) node.focus()
    },
    [autoFocus]
  )
  return (
    <Dropdown.Item
      role="menuitem"
      className="btn-link text-left dropdown-menu-button"
      onClick={handleClick}
      ref={handleListItem}
    >
      {content}
    </Dropdown.Item>
  )
}
