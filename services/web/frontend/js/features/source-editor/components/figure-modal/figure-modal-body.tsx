import { Alert } from 'react-bootstrap'
import {
  FigureModalSource,
  useFigureModalContext,
} from './figure-modal-context'
import { FigureModalHelp } from './figure-modal-help'
import { FigureModalFigureOptions } from './figure-modal-options'
import { FigureModalSourcePicker } from './figure-modal-source-picker'
import { FigureModalEditFigureSource } from './file-sources/figure-modal-edit-figure-source'
import { FigureModalOtherProjectSource } from './file-sources/figure-modal-other-project-source'
import { FigureModalCurrentProjectSource } from './file-sources/figure-modal-project-source'
import { FigureModalUploadFileSource } from './file-sources/figure-modal-upload-source'
import { FigureModalUrlSource } from './file-sources/figure-modal-url-source'
import { useCallback } from 'react'

const sourceModes = new Map([
  [FigureModalSource.FILE_TREE, FigureModalCurrentProjectSource],
  [FigureModalSource.FROM_URL, FigureModalUrlSource],
  [FigureModalSource.OTHER_PROJECT, FigureModalOtherProjectSource],
  [FigureModalSource.FILE_UPLOAD, FigureModalUploadFileSource],
  [FigureModalSource.EDIT_FIGURE, FigureModalEditFigureSource],
])

export const FigureModalBody = () => {
  const { source, helpShown, sourcePickerShown, error, dispatch } =
    useFigureModalContext()
  const Body = sourceModes.get(source)
  const onDismiss = useCallback(() => {
    dispatch({ error: undefined })
  }, [dispatch])

  if (helpShown) {
    return <FigureModalHelp />
  }

  if (sourcePickerShown) {
    return <FigureModalSourcePicker />
  }

  if (!Body) {
    return null
  }

  return (
    <>
      {error && (
        <Alert bsStyle="danger" onDismiss={onDismiss}>
          {error}
        </Alert>
      )}
      <Body />
      <FigureModalFigureOptions />
    </>
  )
}
