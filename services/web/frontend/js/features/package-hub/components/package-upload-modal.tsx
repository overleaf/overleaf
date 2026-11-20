import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import type { UploadValidationResult } from '../types'
import { uploadCustomPackage, validateUploadFile } from '../util/api'

export default function PackageUploadModal({
  show,
  onHide,
  onJobStarted,
}: {
  show: boolean
  onHide: () => void
  onJobStarted: (jobId: string, label: string) => void
}) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [packageName, setPackageName] = useState('')
  const [description, setDescription] = useState('')
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [validation, setValidation] = useState<UploadValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const resetAndClose = () => {
    setFile(null)
    setPackageName('')
    setDescription('')
    setValidation(null)
    setError(null)
    setValidating(false)
    setSubmitting(false)
    onHide()
  }

  const pickFile = useCallback((selected: File | null) => {
    setError(null)
    setValidation(null)
    setFile(selected)
    if (selected) {
      const guessed = selected.name
        .replace(/\.(tar\.gz|tgz|zip|sty|cls|bst|bib|def|fd|cfg)$/i, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
      setPackageName(guessed)
    }
  }, [])

  const buildFormData = () => {
    if (!file) return null
    const fd = new FormData()
    fd.append('file', file)
    if (packageName.trim()) fd.append('packageName', packageName.trim())
    if (description.trim()) fd.append('description', description.trim())
    return fd
  }

  const handleDryRun = async () => {
    const fd = buildFormData()
    if (!fd) return
    setValidating(true)
    setError(null)
    try {
      const res = await validateUploadFile(fd)
      setValidation(res)
      if (res.packageName && !packageName.trim()) {
        setPackageName(res.packageName)
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  const handleInstall = async () => {
    const fd = buildFormData()
    if (!fd) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await uploadCustomPackage(fd)
      onJobStarted(res.jobId, `Installing custom package ${res.packageName}`)
      resetAndClose()
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <OLModal
      show={show}
      onHide={resetAndClose}
      size="lg"
      id="package-hub-upload-modal"
    >
      <OLModalHeader>
        <OLModalTitle>{t('package_hub_upload_modal_title')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        {error && (
          <Notification
            type="error"
            content={error}
            className="mb-3"
            isDismissible
            onDismiss={() => setError(null)}
          />
        )}

        <div
          className={`package-hub-dropzone mb-3 ${dragging ? 'is-dragging' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              inputRef.current?.click()
            }
          }}
          onDragOver={e => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault()
            setDragging(false)
            const dropped = e.dataTransfer?.files?.[0] || null
            pickFile(dropped)
          }}
        >
          <input
            ref={inputRef}
            type="file"
            className="d-none"
            accept=".sty,.cls,.bst,.bib,.zip,.tar.gz,.tgz,.def,.fd,.cfg"
            onChange={e => pickFile(e.target.files?.[0] || null)}
          />
          {file ? (
            <div>
              <strong className="font-monospace">{file.name}</strong>
              <div className="small text-muted mt-1">
                {Math.max(1, Math.round(file.size / 1024))} KB
              </div>
            </div>
          ) : (
            <div className="text-muted">
              <div>{t('package_hub_upload_drop_hint')}</div>
            </div>
          )}
        </div>

        <OLFormGroup className="mb-3">
          <OLFormLabel htmlFor="upload-pkg-name">
            {t('package_hub_upload_pkg_name')}
          </OLFormLabel>
          <OLFormControl
            id="upload-pkg-name"
            type="text"
            value={packageName}
            onChange={e => setPackageName(e.target.value)}
            placeholder="my-custom-style"
          />
        </OLFormGroup>

        <OLFormGroup className="mb-3">
          <OLFormLabel htmlFor="upload-pkg-desc">
            {t('package_hub_upload_pkg_desc')}
          </OLFormLabel>
          <OLFormControl
            id="upload-pkg-desc"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Custom conference template or macro definitions"
          />
        </OLFormGroup>

        {validating && (
          <Notification
            type="info"
            content={t('package_hub_upload_validating')}
            className="mb-3"
          />
        )}

        {validation && (
          <div className="mb-2">
            <Notification
              type={validation.compileTest.passed ? 'success' : 'warning'}
              content={
                validation.compileTest.passed
                  ? t('package_hub_upload_valid_ok')
                  : t('package_hub_upload_valid_warn')
              }
              className="mb-2"
            />
            <div className="small text-muted mb-1">
              Detected package: <strong className="font-monospace">{validation.packageName}</strong>{' '}
              ({validation.detectedType}, {validation.sizeKb} KB, {validation.files.length} file(s))
            </div>
            <pre className="package-hub-terminal-log mb-0">
              {validation.compileTest.log}
            </pre>
          </div>
        )}
      </OLModalBody>

      <OLModalFooter>
        <OLButton variant="secondary" onClick={resetAndClose} disabled={submitting}>
          {t('cancel')}
        </OLButton>
        <OLButton
          variant="secondary"
          disabled={!file || validating || submitting}
          isLoading={validating}
          onClick={handleDryRun}
          leadingIcon="science"
        >
          {t('package_hub_upload_validate_btn')}
        </OLButton>
        <OLButton
          variant="primary"
          disabled={!file || submitting}
          isLoading={submitting}
          onClick={handleInstall}
          leadingIcon="upload_file"
        >
          {t('package_hub_upload_confirm_btn')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
