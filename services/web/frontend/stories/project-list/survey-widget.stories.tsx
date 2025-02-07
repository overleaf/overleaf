import SurveyWidget from '../../js/features/project-list/components/survey-widget'

export const Survey = (args: any) => {
  localStorage.clear()
  window.metaAttributesCache.set('ol-survey', {
    name: 'my-survey',
    preText: 'To help shape the future of Overleaf',
    linkText: 'Click here!',
    url: 'https://example.com/my-survey',
  })

  return <SurveyWidget {...args} />
}

export const UndefinedSurvey = (args: any) => {
  localStorage.clear()

  return <SurveyWidget {...args} />
}

export const EmptySurvey = (args: any) => {
  localStorage.clear()
  window.metaAttributesCache.set('ol-survey', {})

  return <SurveyWidget {...args} />
}

export default {
  title: 'Project List / Survey Widget',
  component: SurveyWidget,
  parameters: {
    bootstrap5: true,
  },
}
