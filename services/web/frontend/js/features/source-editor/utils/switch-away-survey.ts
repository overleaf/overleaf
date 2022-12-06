import localStorage from '../../../infrastructure/local-storage'

const surveyOneKey = 'editor.has_seen_cm6_switch_away_survey'

export function setHasSeenCM6SwitchAwaySurvey() {
  localStorage.setItem(surveyOneKey, true)
}

export function hasSeenCM6SwitchAwaySurvey() {
  return !!localStorage.getItem(surveyOneKey)
}
