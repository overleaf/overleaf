import { SurveyWidgetDsNav } from '@/features/project-list/components/survey-widget-ds-nav'

export const Survey = (args: any) => {
  localStorage.clear()
  window.metaAttributesCache.set('ol-survey', {
    name: 'my-survey',
    title: 'To help shape the future of Overleaf',
    text: 'Click here!',
    cta: 'Let’s go!',
    url: 'https://example.com/my-survey',
  })

  return <SurveyWidgetDsNav {...args} />
}

export const UndefinedSurvey = (args: any) => {
  localStorage.clear()

  return <SurveyWidgetDsNav {...args} />
}

export const EmptySurvey = (args: any) => {
  localStorage.clear()
  window.metaAttributesCache.set('ol-survey', {})

  return <SurveyWidgetDsNav {...args} />
}

export default {
  title: 'Project List / Survey Widget',
  component: SurveyWidgetDsNav,
}
