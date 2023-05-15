import { FC, useEffect } from 'react'
import { FileContainer, FileUploadStatus } from './figure-modal-upload-source'
import {
  useFigureModalContext,
  useFigureModalExistingFigureContext,
} from '../figure-modal-context'

export const FigureModalEditFigureSource: FC = () => {
  const { dispatch } = useFigureModalContext()
  const { name } = useFigureModalExistingFigureContext()

  useEffect(() => {
    if (name === undefined) {
      dispatch({ getPath: undefined })
    } else {
      dispatch({ getPath: async () => name })
    }
  }, [name, dispatch])

  return (
    <FileContainer
      name={name ?? 'Unknown'}
      status={FileUploadStatus.SUCCESS}
      onDelete={() => {
        dispatch({ sourcePickerShown: true })
      }}
    />
  )
}
