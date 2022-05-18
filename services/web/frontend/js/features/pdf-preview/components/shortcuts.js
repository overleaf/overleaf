import { useCallback } from 'react'
import { useDetachCompileContext } from '../../../shared/context/detach-compile-context'
import PropTypes from 'prop-types'

export const Shortcuts = ({ children }) => {
  const { startCompile } = useDetachCompileContext()

  const handleKeyDown = useCallback(
    event => {
      if (event.metaKey) {
        switch (event.key) {
          case 's':
          case 'Enter':
            event.preventDefault()
            startCompile({ keyShortcut: true })
            break
        }
      } else if (event.ctrlKey) {
        switch (event.key) {
          case '.':
            event.preventDefault()
            startCompile({ keyShortcut: true })
            break
        }
      }
    },
    [startCompile]
  )

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div onKeyDown={handleKeyDown} role="tabpanel" tabIndex="0">
      {children}
    </div>
  )
}
Shortcuts.propTypes = {
  children: PropTypes.node,
}
