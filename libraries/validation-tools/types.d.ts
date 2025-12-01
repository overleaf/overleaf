import z from 'zod'

export interface DatetimeSchemaOptions extends z.core.$ZodISODateTimeParams {
  allowNull?: boolean
  allowUndefined?: boolean
}
