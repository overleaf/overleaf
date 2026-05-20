import {
  FC,
  KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { CommandPaletteSearchResult } from '../types'
import { OLModal, OLModalBody } from '@/shared/components/ol/ol-modal'
import classNames from 'classnames'
import useEventListener from '@/shared/hooks/use-event-listener'
import useCommandPaletteResults from '../hooks/use-command-palette-results'
import { debugConsole } from '@/utils/debugging'

type CommandPaletteBodyProps = {
  show: boolean
  onHide(): void
}

const CommandPaletteBody: FC<CommandPaletteBodyProps> = ({ show, onHide }) => {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const resultsRef = useRef<HTMLUListElement>(null)
  const results = useCommandPaletteResults(query)

  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  useEffect(() => {
    const el = resultsRef.current?.children[selectedIndex] as
      | HTMLElement
      | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  const runResult = (result: CommandPaletteSearchResult) => {
    try {
      const res = result.onSelect(result)
      if (res instanceof Promise) {
        res.catch(err => {
          debugConsole.error('Command palette command error', err)
        })
      }
    } catch (err) {
      debugConsole.error('Command palette command error', err)
    } finally {
      onHide()
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(i => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(i => (i - 1 + results.length) % results.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const selected = results[selectedIndex]
      if (selected) runResult(selected)
    }
  }

  useEventListener(
    'mousedown',
    useCallback(
      (event: MouseEvent) => {
        if (!show) return
        const target = event.target as Element | null
        if (target?.closest('.command-palette .modal-dialog')) return
        onHide()
      },
      [show, onHide]
    )
  )

  return (
    <OLModal
      show={show}
      onHide={onHide}
      className="command-palette"
      returnFocusOnDeactivate
      animation={false}
      backdrop={false}
      clickOutsideDeactivates
    >
      <OLModalBody>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type a command..."
          aria-label="Command palette search"
          className="command-palette-input"
        />
        <ul ref={resultsRef} className="command-palette-results">
          {results.map((result, index) => (
            <li
              role="none"
              key={index}
              className={classNames('command-palette-result', {
                'command-palette-result-selected': index === selectedIndex,
              })}
            >
              <button
                role="menuitem"
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => runResult(result)}
              >
                <div className="command-palette-result-title">
                  {result.title}
                </div>
                {result.description && (
                  <div className="command-palette-result-description">
                    {result.description}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      </OLModalBody>
    </OLModal>
  )
}

export default memo(CommandPaletteBody)
