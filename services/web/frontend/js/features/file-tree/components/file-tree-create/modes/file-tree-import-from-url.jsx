import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FileTreeCreateNameInput from '../file-tree-create-name-input'
import { useFileTreeActionable } from '../../../contexts/file-tree-actionable'
import { useFileTreeCreateName } from '../../../contexts/file-tree-create-name'
import { useFileTreeCreateForm } from '../../../contexts/file-tree-create-form'
import ErrorMessage from '../error-message'
import * as eventTracking from '../../../../../infrastructure/event-tracking'
import OLFormGroup from '@/features/ui/components/ol/ol-form-group'
import OLFormLabel from '@/features/ui/components/ol/ol-form-label'
import OLFormControl from '@/features/ui/components/ol/ol-form-control'

export default function FileTreeImportFromUrl() {
  const { t } = useTranslation()
  const { name, setName, validName } = useFileTreeCreateName()
  const { setValid } = useFileTreeCreateForm()
  const { finishCreatingLinkedFile, error, inFlight } = useFileTreeActionable()

  const [url, setUrl] = useState('')

  const handleChange = useCallback(event => {
    setUrl(event.target.value)
  }, [])

  // set the name when the URL changes
  useEffect(() => {
    if (url) {
      const matches = url.match(/^\s*https?:\/\/.+\/([^/]+\.(\w+))\s*$/)
      setName(matches ? matches[1] : '')
    }
  }, [setName, url])

  // form validation: URL is set and name is valid
  useEffect(() => {
    setValid(validName && !!url)
  }, [setValid, validName, url])

  // form submission: create a linked file with this name, from this URL
  const handleSubmit = event => {
    event.preventDefault()
    eventTracking.sendMB('new-file-created', {
      method: 'url',
      extension: name.split('.').length > 1 ? name.split('.').pop() : '',
    })
    finishCreatingLinkedFile({
      name,
      provider: 'url',
      data: { url: url.trim() },
    })
  }

  return (
    <form
      className="form-controls"
      id="create-file"
      noValidate
      onSubmit={handleSubmit}
    >
      <OLFormGroup controlId="import-from-url">
        <OLFormLabel>{t('url_to_fetch_the_file_from')}</OLFormLabel>
        <OLFormControl
          type="url"
          placeholder="https://example.com/my-file.png"
          required
          value={url}
          onChange={handleChange}
        />
      </OLFormGroup>

      <FileTreeCreateNameInput
        label={t('file_name_in_this_project')}
        placeholder="my_file"
        error={error}
        inFlight={inFlight}
      />

      {error && <ErrorMessage error={error} />}
    </form>
  )
}
