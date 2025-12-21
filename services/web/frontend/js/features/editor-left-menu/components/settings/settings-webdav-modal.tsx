import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from 'react-bootstrap'
import {
    OLModalBody,
    OLModalFooter,
    OLModalHeader,
    OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormControl from '@/shared/components/ol/ol-form-control'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLForm from '@/shared/components/ol/ol-form'
import OLFormCheckbox from '@/shared/components/ol/ol-form-checkbox'
import Notification from '@/shared/components/notification'
import { postJSON, getUserFacingMessage } from '@/infrastructure/fetch-json'
import useAsync from '@/shared/hooks/use-async'
import { useProjectContext } from '@/shared/context/project-context'

type WebDAVConfig = {
    url: string
    basePath: string
    enabled?: boolean
    hasUsername?: boolean
    hasPassword?: boolean
}

type Props = {
    show: boolean
    onClose: () => void
    currentConfig?: WebDAVConfig | null
    onSaved?: () => void
}

export default function WebDAVSettingsModal({
    show,
    onClose,
    currentConfig,
    onSaved,
}: Props) {
    const { t } = useTranslation()
    const { projectId } = useProjectContext()
    const { isLoading, isError, error, runAsync } = useAsync()

    const [url, setUrl] = useState(currentConfig?.url || '')
    const [basePath, setBasePath] = useState(currentConfig?.basePath || '/overleaf')
    
    // Username/password with enable toggles
    const [useUsername, setUseUsername] = useState(currentConfig?.hasUsername || false)
    const [username, setUsername] = useState('')
    const [usePassword, setUsePassword] = useState(currentConfig?.hasPassword || false)
    const [password, setPassword] = useState('')

    // Unlink confirmation modal state
    const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false)
    const [keepRemoteContent, setKeepRemoteContent] = useState(true)

    // Reset form when modal opens with new config
    React.useEffect(() => {
        if (show) {
            setUrl(currentConfig?.url || '')
            setBasePath(currentConfig?.basePath || '/overleaf')
            setUseUsername(currentConfig?.hasUsername || false)
            setUsername('')
            setUsePassword(currentConfig?.hasPassword || false)
            setPassword('')
            setShowUnlinkConfirm(false)
            setKeepRemoteContent(true)
        }
    }, [show, currentConfig])

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()

            if (!url.trim()) {
                return
            }

            try {
                await runAsync(
                    postJSON(`/project/${projectId}/webdav/link`, {
                        body: {
                            webdavConfig: {
                                url: url.trim(),
                                basePath: basePath.trim() || '/overleaf',
                                // Only send credentials if enabled
                                // If enabled but empty, backend will preserve existing value
                                useUsername,
                                username: useUsername ? username.trim() : '',
                                usePassword,
                                password: usePassword ? password : '',
                            },
                        },
                    })
                )
                onSaved?.()
                onClose()
                // Reload page to refresh webdavConfig in project context
                window.location.reload()
            } catch {
                // Error handled by useAsync
            }
        },
        [projectId, url, basePath, useUsername, username, usePassword, password, runAsync, onClose, onSaved]
    )

    const handleUnlinkClick = useCallback(() => {
        setShowUnlinkConfirm(true)
    }, [])

    const handleUnlinkCancel = useCallback(() => {
        setShowUnlinkConfirm(false)
        setKeepRemoteContent(true)
    }, [])

    const handleUnlinkConfirm = useCallback(async () => {
        try {
            await runAsync(postJSON(`/project/${projectId}/webdav/unlink`, {
                body: {
                    deleteRemoteContent: !keepRemoteContent,
                },
            }))
            onSaved?.()
            onClose()
            // Reload page to refresh webdavConfig in project context
            window.location.reload()
        } catch {
            // Error handled by useAsync
        }
    }, [projectId, keepRemoteContent, runAsync, onClose, onSaved])

    const handleSync = useCallback(async () => {
        try {
            await runAsync(postJSON(`/project/${projectId}/webdav/sync`, {}))
            onSaved?.()
        } catch {
            // Error handled by useAsync
        }
    }, [projectId, runAsync, onSaved])

    // Render unlink confirmation modal
    if (showUnlinkConfirm) {
        return (
            <Modal show={show} onHide={handleUnlinkCancel}>
                <OLModalHeader closeButton>
                    <OLModalTitle>{t('unlink_cloud_storage')}</OLModalTitle>
                </OLModalHeader>

                <OLModalBody>
                    {isError && (
                        <div className="notification-list">
                            <Notification
                                type="error"
                                content={getUserFacingMessage(error) as string}
                            />
                        </div>
                    )}

                    <p>{t('unlink_cloud_storage_description')}</p>

                    <div className="mb-3">
                        <OLFormCheckbox
                            label={t('keep_cloud_storage_content')}
                            checked={keepRemoteContent}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                setKeepRemoteContent(e.target.checked)
                            }}
                        />
                    </div>

                    {!keepRemoteContent && (
                        <Notification
                            type="warning"
                            content={t('delete_remote_content_warning')}
                        />
                    )}
                </OLModalBody>

                <OLModalFooter>
                    <OLButton
                        variant="secondary"
                        onClick={handleUnlinkCancel}
                        disabled={isLoading}
                    >
                        {t('cancel')}
                    </OLButton>
                    <OLButton
                        variant={keepRemoteContent ? 'primary' : 'danger'}
                        onClick={handleUnlinkConfirm}
                        disabled={isLoading}
                        isLoading={isLoading}
                    >
                        {keepRemoteContent ? t('unlink') : t('unlink_and_delete')}
                    </OLButton>
                </OLModalFooter>
            </Modal>
        )
    }

    return (
        <Modal show={show} onHide={onClose}>
            <OLModalHeader closeButton>
                <OLModalTitle>{t('cloud_storage_settings')}</OLModalTitle>
            </OLModalHeader>

            <OLModalBody>
                {isError && (
                    <div className="notification-list">
                        <Notification
                            type="error"
                            content={getUserFacingMessage(error) as string}
                        />
                    </div>
                )}

                <OLForm onSubmit={handleSubmit}>
                    <OLFormGroup controlId="webdav-url">
                        <OLFormLabel>{t('webdav_url')}</OLFormLabel>
                        <OLFormControl
                            type="text"
                            placeholder="https://nextcloud.example.com/remote.php/dav/files/username/"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            required
                        />
                        <small className="text-muted">
                            {t('webdav_url_hint')}
                        </small>
                    </OLFormGroup>

                    <OLFormGroup controlId="webdav-username">
                        <OLFormCheckbox
                            label={t('use_username')}
                            checked={useUsername}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUseUsername(e.target.checked)}
                        />
                        {useUsername && (
                            <OLFormControl
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder={currentConfig?.hasUsername ? t('leave_blank_to_keep_current') : ''}
                                className="mt-2"
                            />
                        )}
                    </OLFormGroup>

                    <OLFormGroup controlId="webdav-password">
                        <OLFormCheckbox
                            label={t('use_password')}
                            checked={usePassword}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsePassword(e.target.checked)}
                        />
                        {usePassword && (
                            <OLFormControl
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder={currentConfig?.hasPassword ? t('leave_blank_to_keep_current') : ''}
                                className="mt-2"
                            />
                        )}
                    </OLFormGroup>

                    <OLFormGroup controlId="webdav-base-path">
                        <OLFormLabel>{t('webdav_base_path')}</OLFormLabel>
                        <OLFormControl
                            type="text"
                            value={basePath}
                            onChange={e => setBasePath(e.target.value)}
                            placeholder="/overleaf"
                        />
                        <small className="text-muted">
                            {t('webdav_base_path_hint')}
                        </small>
                    </OLFormGroup>
                </OLForm>
            </OLModalBody>

            <OLModalFooter>
                {currentConfig?.url && (
                    <>
                        <OLButton
                            variant="danger"
                            onClick={handleUnlinkClick}
                            disabled={isLoading}
                        >
                            {t('unlink')}
                        </OLButton>
                        <OLButton
                            variant="info"
                            onClick={handleSync}
                            disabled={isLoading}
                            className="ms-2"
                        >
                            {t('sync_now')}
                        </OLButton>
                    </>
                )}
                <div className="ms-auto d-flex gap-2">
                    <OLButton variant="secondary" onClick={onClose} disabled={isLoading}>
                        {t('cancel')}
                    </OLButton>
                    <OLButton
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={isLoading || !url.trim()}
                        isLoading={isLoading}
                    >
                        {t('save')}
                    </OLButton>
                </div>
            </OLModalFooter>
        </Modal>
    )
}
