import { FC } from 'react'
import { Trans, useTranslation } from 'react-i18next'

const LearnWikiLink: FC<React.PropsWithChildren<{ article: string }>> = ({
  article,
  children,
}) => {
  return <a href={`/learn/latex/${article}`}>{children}</a>
}

export const FigureModalHelp = () => {
  const { t } = useTranslation()
  return (
    <>
      <p>{t('this_tool_helps_you_insert_figures')}</p>
      <b>{t('editing_captions')}</b>
      <p>{t('when_you_tick_the_include_caption_box')}</p>

      <b>{t('understanding_labels')}</b>
      <p>
        <Trans
          i18nKey="labels_help_you_to_easily_reference_your_figures"
          components={[
            // eslint-disable-next-line react/jsx-key
            <code />,
            // eslint-disable-next-line react/jsx-key
            <LearnWikiLink article="Inserting_Images#Labels_and_cross-references" />,
          ]}
        />
      </p>

      <b>{t('customizing_figures')}</b>
      <p>
        <Trans
          i18nKey="there_are_lots_of_options_to_edit_and_customize_your_figures"
          components={[
            // eslint-disable-next-line react/jsx-key
            <LearnWikiLink article="Inserting_Images" />,
          ]}
        />
      </p>

      <b>{t('changing_the_position_of_your_figure')}</b>
      <p>
        <Trans
          i18nKey="latex_places_figures_according_to_a_special_algorithm"
          components={[
            // eslint-disable-next-line react/jsx-key
            <LearnWikiLink article="Positioning_images_and_tables" />,
          ]}
        />
      </p>

      <b>{t('dealing_with_errors')}</b>
      <p>
        <Trans
          i18nKey="are_you_getting_an_undefined_control_sequence_error"
          components={[
            // eslint-disable-next-line react/jsx-key
            <code />,
            // eslint-disable-next-line react/jsx-key
            <LearnWikiLink article="Inserting_Images" />,
          ]}
        />
      </p>
    </>
  )
}
