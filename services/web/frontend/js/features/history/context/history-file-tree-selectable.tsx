import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import classNames from 'classnames'
import _ from 'lodash'

import usePreviousValue from '../../../shared/hooks/use-previous-value'
import { Nullable } from '../../../../../types/utils'

type Context = {
  select: (id: string) => void
  selectedFile: Nullable<string>
}

const FileTreeSelectableContext = createContext<Context>({
  select: () => {},
  selectedFile: null,
})

type HistoryFileTreeSelectableProviderProps = {
  onSelectFile: (id: string) => void
  children: ReactNode
}

export function HistoryFileTreeSelectableProvider({
  onSelectFile,
  children,
}: HistoryFileTreeSelectableProviderProps) {
  const [selectedFile, setSelectedFile] =
    useState<Context['selectedFile']>(null)

  const previousSelectedFile = usePreviousValue(selectedFile)

  useEffect(() => {
    if (!selectedFile) {
      return
    }

    if (_.isEqual(selectedFile, previousSelectedFile)) {
      return
    }

    onSelectFile(selectedFile)
  }, [selectedFile, previousSelectedFile, onSelectFile])

  const select = useCallback(id => {
    setSelectedFile(id)
  }, [])

  const value = {
    selectedFile,
    select,
  }

  return (
    <FileTreeSelectableContext.Provider value={value}>
      {children}
    </FileTreeSelectableContext.Provider>
  )
}

export function useSelectableEntity(id: string) {
  const { selectedFile, select } = useContext(FileTreeSelectableContext)

  const handleClick = useCallback(() => {
    select(id)
  }, [id, select])

  const isSelected = selectedFile === id

  const props = useMemo(
    () => ({
      className: classNames({ selected: isSelected }),
      'aria-selected': isSelected,
      onClick: handleClick,
    }),
    [handleClick, isSelected]
  )

  return { isSelected, props }
}
