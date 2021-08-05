// The collator used to sort files docs and folders in the tree.
// Uses English as base language for consistency.
// Options used:
// numeric: true so 10 comes after 2
// sensitivity: 'variant' so case and accent are not equal
// caseFirst: 'upper' so upper-case letters come first
export const fileCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'variant',
  caseFirst: 'upper',
})
