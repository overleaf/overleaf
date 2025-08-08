import { useDetachCompileContext as useCompileContext } from '@/shared/context/detach-compile-context'
import { useTranslation } from 'react-i18next'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import LeftMenuButton from '@/features/editor-left-menu/components/left-menu-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { memo } from 'react'

export const WordCountButton = memo<{
  handleShowModal: () => void
}>(function WordCountButton({ handleShowModal }) {
  const { pdfUrl } = useCompileContext()
  const { t } = useTranslation()

  const enabled = pdfUrl || isSplitTestEnabled('word-count-client')

  if (!enabled) {
    return (
      <OLTooltip
        id="disabled-word-count"
        description={t('please_compile_pdf_before_word_count')}
        overlayProps={{
          placement: 'top',
        }}
      >
        {/* OverlayTrigger won't fire unless the child is a non-react html element (e.g div, span) */}
        <div>
          <LeftMenuButton
            icon="match_case"
            disabled
            disabledAccesibilityText={t('please_compile_pdf_before_word_count')}
          >
            {t('word_count')}
          </LeftMenuButton>
        </div>
      </OLTooltip>
    )
  }

  return (
    <LeftMenuButton onClick={handleShowModal} icon="match_case">
      {t('word_count')}
    </LeftMenuButton>
  )
})
