import { type z } from 'zod'
import { Config } from './config'

/* eslint-disable @typescript-eslint/no-namespace */
export namespace Data {
  export namespace Config {
    export type Self = z.infer<typeof Config.Self>;
  }
}
export { Config }

