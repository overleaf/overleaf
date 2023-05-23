export const disableControlsOf = (...args: string[]) => {
  return args.reduce<Record<string, object>>((prev, cur) => {
    return {
      ...prev,
      [cur]: {
        table: {
          disable: true,
        },
      },
    }
  }, {})
}
