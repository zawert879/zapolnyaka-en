/* eslint-disable no-await-in-loop */
import ProgressBar from 'progress'
import { type Playwright } from './Playwright'
import { type Page } from '@playwright/test'
import { chunkArray, timeout } from '../utils'
import { type Line } from './CustomCsvParser'
import { type Data } from '../data'

export class Zapolnyaka {
  private _playwright: Playwright
  private _config: Data.Config.Self
  constructor(playwright: Playwright, config: Data.Config.Self) {
    this._playwright = playwright
    this._config = config
  }

  async auth() {
    const page = await this._playwright.mainPage()
    await page.goto(`https://${this._config.domain}/Login.aspx?return=%2fDefault.aspx&lang=ru`)
    await page.getByPlaceholder('логин или id').fill(this._config.login)
    await page.getByPlaceholder('пароль').fill(this._config.password)
    await page.getByRole('button', { name: 'Вход' }).click()
  }

  async openLevel(level: number): Promise<Page> {
    const page = await this._playwright.mainPage()
    await page.goto(`https://${this._config.domain}/Administration/Games/LevelEditor.aspx?gid=${this._config.gameId}&level=${level}`)
    return page
  }

  async go(lines: Line[]) {
    await this.auth()
    const { level } = this._config
    const page = await this.openLevel(level)

    const bar = new ProgressBar('progress: [:bar] :current/:total :percent :eta', { total: lines.length })

    for (let i = 0; i < lines.length; i++) {
      bar.tick(i)
      const element = lines[i]
      if (element.isAnswer) {
        await this.addAnswersToSector(page, element.column, element.answers)
      }

      if (element.isBonus) {
        await this.addBonus(
          {
            page,
            sector: element.column,
            answers: element.answers,
            time: { hours: element.time.hour(), minutes: element.time.minute(), seconds: element.time.second() },
            isNegative: element.isPenalty,
            level,
          },
        )
        await timeout(1000)
      }

      await timeout(2000)
    }
  }

  async addAnswersToSector(page: Page, sector: string, answers: string[]) {
    try {
      await page.getByRole('link', { name: 'показать' }).click({
        timeout: 1,
      })
    } catch (error) {
      console.log('not found')
    }

    await timeout(1000)

    const chunks = chunkArray(answers, 10)
    const first = chunks.slice(0, 1)[0]
    const others = chunks.slice(1)
    await this.addAnswersToNewSector(page, sector, first)
    await timeout(1000)
    for (const element of others) {
      await timeout(2000)
      await this.addAnswersToLastSector(page, element)
    }
  }

  private async addAnswersToNewSector(page: Page, sector: string, answers: string[]) {
    // Есть ограничение только 10 ответов
    await page.getByRole('link', { name: 'Добавить сектор' }).click()
    await page.locator('input[name="txtSectorName"]').first().click()

    await page.locator('input[name="txtSectorName"]').first().fill(sector)

    const loc = page.locator('#AnswersTable_ctl00_divSectorEdit')

    for (let i = 0; i < answers.length; i++) {
      await loc.locator(`input[name="txtAnswer_${i}"]`).fill(answers[i])
    }

    await page.getByRole('button', { name: 'Сохранить' }).click()
  }

  private async addAnswersToLastSector(page: Page, answers: string[]) {
    // Есть ограничение только 10 ответов
    const loc = page.locator('#AnswersTable_ctl00_divAnswersContainer > .noPadMarg')
    const text = await loc.last().innerHTML()

    const match = /id="divAnswersEdit_(\d+)"/.exec(text)
    if (match) {
      const id = match[1]
      await page.getByText('Добавить ответы').click()
      await page.locator('#ddlSector').selectOption(id.toString())
      const loc = page.locator('#AnswersTable_ctl00_NewAnswerEditor')
      for (let i = 0; i < answers.length; i++) {
        await loc.locator(`input[name="txtAnswer_${i}"]`).fill(answers[i])
      }

      await page.getByRole('button', { name: 'Сохранить' }).click()
    }
  }

  private async addBonus(
    options: {
      page: Page;
      sector: string;
      answers: string[];
      time: { hours: number; minutes: number; seconds: number };
      isNegative: boolean;
      level: number;
    },
  ) {
    const popupPromise = options.page.waitForEvent('popup')
    await options.page.getByRole('link', { name: 'Добавить' }).nth(2).click()
    const popup = await popupPromise
    const chunks = chunkArray(options.answers, 100)
    const first = chunks.slice(0, 1)[0]
    const others = chunks.slice(1)

    await this.addNewBonus({
      answers: first,
      isNegative: options.isNegative,
      level: options.level,
      popup,
      sector: options.sector,
      time: options.time,
    })
    await timeout(1000)
    for (const element of others) {
      await this.addAnswersToBonus(popup, element)
      await timeout(2000)
    }

    await popup.close()
  }

  private async addAnswersToBonus(popup: Page, answers: string[]) {
    await popup.getByRole('link', { name: 'Редактировать' }).last().click()
    await popup.getByRole('link', { name: '30' }).click()
    await popup.getByRole('link', { name: '30' }).click()
    await popup.getByRole('link', { name: '30' }).click()
    await popup.getByRole('link', { name: '30' }).click()
    for (let i = 0; i < answers.length; i++) {
      await popup.locator(`input[name="answer_-${i + 1}"]`).fill(answers[i])
    }

    await popup.getByRole('button', { name: 'Обновить' }).click()
  }

  private async addNewBonus(options: {
    popup: Page;
    sector: string;
    answers: string[];
    time: { hours: number; minutes: number; seconds: number };
    isNegative: boolean;
    level: number;
  }) {
    const { popup, answers, sector, level, time, isNegative } = options
    await popup.locator('input[name="txtBonusName"]').fill(sector)
    await popup.getByRole('link', { name: '30' }).click()
    await popup.getByRole('link', { name: '30' }).click()
    await popup.getByRole('link', { name: '30' }).click()

    for (let i = 0; i < answers.length; i++) {
      await popup.locator(`input[name="answer_-${i + 1}"]`).fill(answers[i])
    }

    const levels = await popup.locator('#levels_container').locator('.levelWrapper').all()
    for (const levelLocator of levels) {
      if ((await levelLocator.getByText(level.toString()).all()).length > 0) {
        await levelLocator.getByRole('checkbox').check()
      }
    }

    await popup.locator('input[name="txtHours"]').fill(time.hours.toString())
    await popup.locator('input[name="txtMinutes"]').fill(time.minutes.toString())
    await popup.locator('input[name="txtSeconds"]').fill(time.seconds.toString())
    if (isNegative) {
      await popup.locator('#negative').click()
    }

    await popup.getByRole('button', { name: 'Добавить' }).click()
  }
}
