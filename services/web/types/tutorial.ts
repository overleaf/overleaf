// todo: maybe change this to just tutorials, and move it from editor context to user context?
export type EditorTutorials = {
  inactiveTutorials: [string]
  deactivateTutorial: (key: string) => void
  currentPopup: string
  setCurrentPopup: (id: string) => void
}
