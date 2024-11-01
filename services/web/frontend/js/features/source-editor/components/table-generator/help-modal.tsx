import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import { useTabularContext } from './contexts/tabular-context'
import { Trans, useTranslation } from 'react-i18next'

export const TableGeneratorHelpModal = () => {
  const { helpShown, hideHelp } = useTabularContext()
  const { t } = useTranslation()
  if (!helpShown) return null

  return (
    <OLModal
      show={helpShown}
      onHide={hideHelp}
      className="table-generator-help-modal"
    >
      <OLModalHeader closeButton>
        <OLModalTitle>{t('help')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <p>
          <Trans
            i18nKey="this_tool_helps_you_insert_simple_tables_into_your_project_without_writing_latex_code_give_feedback"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                href="https://forms.gle/ri3fzV1oQDAjmfmD7"
                target="_blank"
                rel="noopener noreferrer"
              />,
            ]}
          />
        </p>
        <b>{t('how_it_works')}</b>
        <p>
          <Trans
            i18nKey="youll_get_best_results_in_visual_but_can_be_used_in_source"
            // eslint-disable-next-line react/jsx-key
            components={[<b />, <b />]}
          />
        </p>
        <b>{t('customizing_tables')}</b>
        <p>
          <Trans
            i18nKey="if_you_need_to_customize_your_table_further_you_can"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                href="https://www.overleaf.com/learn/latex/Tables"
                target="_blank"
                rel="noopener"
              />,
            ]}
          />
        </p>
        <b>{t('changing_the_position_of_your_table')}</b>
        <p>
          <Trans
            i18nKey="latex_places_tables_according_to_a_special_algorithm"
            components={[
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                href="https://www.overleaf.com/learn/latex/Positioning_images_and_tables"
                target="_blank"
                rel="noopener"
              />,
            ]}
          />
        </p>
        <b>{t('understanding_labels')}</b>
        <p>
          <Trans
            i18nKey="labels_help_you_to_reference_your_tables"
            components={[
              // eslint-disable-next-line react/jsx-key
              <code />,
              // eslint-disable-next-line react/jsx-key, jsx-a11y/anchor-has-content
              <a
                href="https://www.overleaf.com/learn/latex/Inserting_Images#Labels_and_cross-references"
                target="_blank"
                rel="noopener"
              />,
            ]}
          />
        </p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={hideHelp}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}
