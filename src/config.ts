/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-namespace */
import z from 'zod'

export namespace Config {
  export const Self = z.object({
    login: z.string(),
    password: z.string(),
    domain: z.string(),
    gameId: z.number(),
    level: z.number(),
    csv: z.string(),
  })
}
