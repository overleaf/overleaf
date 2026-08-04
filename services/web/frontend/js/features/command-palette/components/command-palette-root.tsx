import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useState,
} from 'react'
import useCommandPaletteTriggers from '../hooks/use-command-palette-triggers'
import CommandPaletteBody from './command-palette-body'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useCommandProvider } from '@/features/ide-react/hooks/use-command-provider'
import { useTranslation } from 'react-i18next'

const CommandPaletteRoot = () => {
  const [show, _setShow] = useState(false)
  const { view } = useLayoutContext()
  const { t } = useTranslation()

  const setShow: Dispatch<SetStateAction<boolean>> = useCallback(
    value => {
      _setShow(view === 'history' ? false : value)
    },
    [view]
  )

  useEffect(() => {
    if (view === 'history') {
      _setShow(false)
    }
  }, [view])

  useCommandPaletteTriggers(setShow)
  const onHide = useCallback(() => setShow(false), [setShow])

  useCommandProvider(() => {
    if (view === 'history') {
      return
    }
    return [
      {
        id: 'command-palette',
        label: t('command_palette'),
        handler: () => setShow(true),
      },
    ]
  }, [view, t, setShow])

  if (!show) {
    return null
  }

  return <CommandPaletteBody show={show} onHide={onHide} />
}

export default CommandPaletteRoot
