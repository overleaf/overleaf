import React, { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'
import OLButton from '@/shared/components/ol/ol-button'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import getMeta from '@/utils/meta'
import WebDAVSettingsModal from './settings-webdav-modal'

type WebDAVConfig = {
    url: string
    username: string
    password: string
    basePath: string
    enabled?: boolean
}

export default function SettingsWebDAV() {
    const { t } = useTranslation()
    const { admin } = usePermissionsContext()
    const [showModal, setShowModal] = useState(false)

    // Get webdavConfig from meta
    const webdavConfig = getMeta('ol-webdavConfig') as WebDAVConfig | null | undefined

    const handleOpenModal = useCallback(() => {
        setShowModal(true)
    }, [])

    const handleCloseModal = useCallback(() => {
        setShowModal(false)
    }, [])

    // Only show to project admins
    if (!admin) {
        return null
    }

    const isLinked = webdavConfig?.enabled && webdavConfig?.url

    return (
        <>
            <OLFormGroup
                controlId="settings-menu-webdav"
                className="left-menu-setting"
            >
                <OLFormLabel>{t('cloud_storage')}</OLFormLabel>
                <div className="d-flex align-items-center gap-2">
                    {isLinked ? (
                        <>
                            <span className="text-success small">
                                <i className="fa fa-check-circle" /> {t('linked')}
                            </span>
                            <OLButton
                                variant="link"
                                size="sm"
                                onClick={handleOpenModal}
                                className="p-0"
                            >
                                {t('edit')}
                            </OLButton>
                        </>
                    ) : (
                        <OLButton
                            variant="link"
                            size="sm"
                            onClick={handleOpenModal}
                            className="p-0"
                        >
                            {t('setup_cloud_storage')}
                        </OLButton>
                    )}
                </div>
            </OLFormGroup>

            <WebDAVSettingsModal
                show={showModal}
                onClose={handleCloseModal}
                currentConfig={webdavConfig}
            />
        </>
    )
}
