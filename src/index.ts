import { Command } from 'commander'
import fs from 'fs'
import { CustomCsvParser } from './Entities/CustomCsvParser'
import { Zapolnyaka } from './Entities/Zapolnyaka'
import { Playwright } from './Entities/Playwright'
import { Config } from './config'

const program = new Command()

program
  .name('zapolnyaka')
  .version('0.0.1')

program.command('go')
  .argument('<conf>', 'start with file config')
  .action(async (configPath: string) => {
    const configRaw = fs.readFileSync(process.cwd() + '/' + configPath, { encoding: 'utf-8' })
    const parseResult = await Config.Self.safeParseAsync(JSON.parse(configRaw))
    if (!parseResult.success) {
      console.log('config not valid', parseResult.error)
      return
    }

    const config = parseResult.data

    console.log('config', config)

    const playwright = new Playwright()
    const csvParser = new CustomCsvParser()
    const zapolnyaka = new Zapolnyaka(playwright, config)

    const lines = csvParser.go(config.csv)
    await zapolnyaka.go(lines)
    await playwright.stop()
  })

program.parse()
