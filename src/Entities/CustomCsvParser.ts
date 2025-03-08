/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from 'fs'
import Table from 'cli-table'
import colors from 'colors/safe'
import dayjs, { type Dayjs } from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

export type Line = { isAnswer: boolean; isBonus: boolean; time: Dayjs; isPenalty: boolean; column: string; answers: string[] }
export class CustomCsvParser {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
  private table = new Table({
    head: ['Ответ?', 'Бонус|Штраф?', 'Время бонуса', 'Сектор', 'Ответы', 'Количество Ответов'],
  })

  private skipLine = 1

  public go(filePath: string) {
    const csv = fs.readFileSync(filePath, { encoding: 'utf8' })

    let lines = this.parseLines(csv.split('\r\n').slice(this.skipLine))
    lines = this.validateLines(lines)
    const row = lines.map(line => [
      line.isAnswer ? colors.green('VVV') : colors.red('XXX'),
      line.isBonus ? line.isPenalty ? colors.yellow('Штраф') : colors.green('Бонус') : colors.red('XXX'),
      line.time.format('H:mm:ss'),
      line.column,
      line.answers.join('\n'),
      line.answers.length.toString(),
    ])
    this.table.push(...row)
    console.log(this.table.toString())
    return lines
  }

  private parseLines(linesRaw: string[]): Line[] {
    const lines = []
    let buff: Line | null = null
    for (const line of linesRaw) {
      const parsedLine = line.split(',')
      if (parsedLine.length === 6) {
        if (buff !== null) {
          const answers = buff.answers.join(',')
          if (answers.startsWith('"')) {
            lines.push({
              ...buff,
              answers: answers
                .slice(1, answers.length - 1)
                .split(','),
            })
          } else {
            lines.push(buff)
          }
        }

        let isAnswer = false
        let isBonus = false
        let isPenalty = false
        if ((parsedLine[0] === 'TRUE' || parsedLine[0] === 'FALSE')) {
          isAnswer = parsedLine[0] === 'TRUE'
        } else {
          throw new Error('Not Valid Line: ')
        }

        if ((parsedLine[1] === 'TRUE' || parsedLine[1] === 'FALSE')) {
          isBonus = parsedLine[1] === 'TRUE'
        } else {
          throw new Error('Not Valid Line: ')
        }

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const time = dayjs(parsedLine[2], 'H:mm:ss')

        if ((parsedLine[3] === 'TRUE' || parsedLine[3] === 'FALSE')) {
          isPenalty = parsedLine[3] === 'TRUE'
        } else {
          throw new Error('Not Valid Line: ')
        }

        const column = parsedLine[4]
        // eslint-disable-next-line no-negated-condition
        const answers = parsedLine[5] !== '' ? parsedLine[5].split('\n') : []
        buff = { isAnswer, isBonus, time, isPenalty, column, answers: [...answers] }
      }

      if (parsedLine.length === 1) {
        buff?.answers.push(...parsedLine)
      }
    }

    return lines
  }

  private validateLines(linesRaw: Line[]) {
    const lines = []
    for (const line of linesRaw) {
      if (!line.isAnswer && !line.isBonus) {
        continue
      }

      if (!line.column) {
        continue
      }

      if (line.answers.length === 0) {
        continue
      }

      lines.push(line)
    }

    return lines
  }
}
