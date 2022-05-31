import { Fragment, memo } from 'react'

const isMac = /Mac/.test(window.navigator.platform)

const symbols: Record<string, string> = isMac
  ? {
      CommandOrControl: '⌘',
      Option: '⌥',
      Control: '⌃',
      Shift: '⇧',
      ArrowRight: '→',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowUp: '↑',
    }
  : {
      CommandOrControl: 'Ctrl',
      Control: 'Ctrl',
      Option: 'Alt',
      Shift: 'Shift',
      ArrowRight: '→',
      ArrowDown: '↓',
      ArrowLeft: '←',
      ArrowUp: '↑',
    }

const separator = isMac ? '' : '+'

const chooseCharacter = (input: string): string =>
  input in symbols ? symbols[input] : input

const Shortcut = ({ shortcut }: { shortcut: string }) => {
  return (
    <div className="shortcut" aria-hidden="true">
      {shortcut.split('+').map((item, index) => {
        const char = chooseCharacter(item)

        return (
          <Fragment key={item}>
            {index > 0 && separator}
            {char.length === 1 ? (
              <span className="shortcut-symbol">{char}</span>
            ) : (
              char
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

export default memo(Shortcut)
