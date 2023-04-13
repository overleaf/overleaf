// Add a final placeholder at the end of the snippet to allow for
// shift-tabbing back from the penultimate placeholder. See #8697.
export const prepareSnippetTemplate = (template: string): string => {
  return template.replace(/\$(\d+)/g, '#{$1}') + '${}'
}
