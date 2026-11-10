import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { F, VERSION } from '../../engine/core.ts'
import { configFor, defaults, defaultStage, plannedQuestions, shareQuery } from '../../engine/session.ts'
import type { Challenge, Game, Stage } from '../../engine/session.ts'
import { digitAnswer, makeRound, solveBox, zapIds, zapName } from '../../engine/zap.ts'
import type { ZapStage } from '../../engine/session.ts'
import type { Question } from '../../engine/questions.ts'

const create = (stages: Stage[], seed: string, mode: Challenge['mode'] = 'timed', title = 'Browser check'): Challenge =>
  ({ seed, title, mode, stages, version: VERSION })

function quant(game: Game, count: number, seconds = 80, itemSeconds = 0) {
  const stage = defaultStage(game, 'timed', defaults)
  if (stage.kind !== 'quant') throw new Error('Expected quantitative stage')
  return { ...stage, count, seconds, itemSeconds }
}
const arcade = (game: typeof zapIds[number], seconds = 120): ZapStage => ({ kind: 'zap', game, difficulty: 3, seconds, rounds: 1 })

async function start(page: Page, challenge: Challenge) {
  await page.goto('./#/challenge?' + shareQuery(challenge))
  await page.getByRole('button', { name: 'Start challenge' }).click()
  await expect(page).toHaveURL(/#\/play\/[0-9a-f]+$/)
}

async function result(page: Page, title = 'Browser check') {
  await expect(page.getByRole('heading', { level: 1, name: title + ' complete' })).toBeVisible()
}

async function clickChoice(page: Page, q: Extract<Question, { kind: 'choice' }>, correct: boolean) {
  const index = q.options.findIndex(option => (option.key === q.truth) === correct)
  await page.getByRole('group', { name: 'Answer choices' }).getByRole('button').nth(index).click()
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
}

async function playArcade(page: Page, c: Challenge, index: number) {
  const stage = c.stages[index] as ZapStage
  const conf = configFor(c, index, stage)
  const round = makeRound(conf.game, conf.seed, 0, conf.difficulty, conf.duration)
  switch (round.game) {
    case 'skyscrapers':
      for (const [from, to] of round.optimal) {
        await page.locator('[data-tower="' + from + '"]').click()
        await page.locator('[data-tower="' + to + '"]').click()
      }
      break
    case 'balloon':
      await page.getByRole('button', { name: 'Pump', exact: true }).click()
      await expect(page.getByRole('img', { name: 'Balloon after 1 pumps' })).toBeVisible()
      await page.getByRole('button', { name: 'Collect', exact: true }).click()
      break
    case 'grill-master': {
      const item = round.items[0]
      await page.clock.fastForward(item.ready + 30)
      await page.getByRole('button', { name: /Grill 1, Cooked/ }).click()
      await expect(page.getByText(/1 cooked · 0 errors/)).toBeVisible()
      await page.clock.fastForward(stage.seconds * 1000)
      break
    }
    case 'figure-it-out':
      for (const [i, value] of round.target.entries()) await page.getByRole('combobox').nth(i).selectOption(String(value))
      await page.getByRole('button', { name: 'Submit guess' }).click()
      break
    case 'number-box': {
      const steps = solveBox(round.values, round.target)
      expect(steps).toHaveLength(3)
      for (const { a, b, op } of steps!) {
        await page.locator('[data-tile="' + a + '"]').click()
        await page.locator('[data-tile="' + b + '"]').click()
        await page.getByRole('button', { name: 'Operator ' + op, exact: true }).click()
      }
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      break
    }
    case 'code-compare':
      await expect(page.getByRole('heading', { name: 'Find the exact match' })).toBeVisible()
      await page.keyboard.press(String(round.answer + 1))
      break
    case 'digit':
      await expect(page.getByLabel('Digits to remember')).toHaveText(round.digits)
      await page.clock.fastForward(round.exposure + 30)
      await expect(page.getByLabel('Digits to remember')).toHaveCount(0)
      await page.getByRole('textbox', { name: 'Recalled sequence' }).fill(digitAnswer(round))
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      break
    case 'the-switch':
      await expect(page.getByRole('heading', { name: 'Answer the highlighted rule' })).toBeVisible()
      await page.keyboard.press(round.answer === 0 ? 'ArrowLeft' : 'ArrowRight')
      break
    case 'shapeshift':
      await page.clock.fastForward(round.delay + 45)
      await expect(page.getByRole('img', { name: round.shape })).toBeVisible()
      await page.keyboard.press(round.answer === 0 ? 'ArrowLeft' : 'ArrowRight')
      break
  }
}

test('portal order, independent arcade routes, reload and browser back', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('./')
  await expect(page).toHaveTitle('Delta Assessments')
  await expect(page.locator('.game-row strong')).toHaveText(['Beat The Odds', 'NumberLogic', 'Likelihood-list', 'Intervals', 'Orderbooks', 'Zap-N', 'Classic 80-in-8'])
  await page.screenshot({ path: info.outputPath('portal.png'), fullPage: true })
  await page.getByRole('link', { name: /Zap-N Nine interactive/ }).click()
  await expect(page.locator('.game-row strong')).toHaveText(zapIds.map(id => zapName[id]))
  for (const id of zapIds) {
    await page.locator('a[href="#/game/' + id + '"]').click()
    await expect(page.getByRole('heading', { level: 1, name: zapName[id] })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { level: 1, name: 'Zap-N' })).toBeVisible()
  }
  await page.goto('./#/game/orderbooks')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Orderbooks' })).toBeVisible()
  expect(errors).toEqual([])
})

for (const game of ['beat-the-odds', 'numberlogic', 'classic-80-in-8'] as const) {
  test(game + ' completes a timed correct, wrong, and skipped response', async ({ page }) => {
    const c = create([quant(game, 3)], game + '-e2e')
    const questions = plannedQuestions(c, 0) as Extract<Question, { kind: 'choice' }>[]
    await start(page, c)
    await clickChoice(page, questions[0], true)
    await expect(page.locator('.solution')).toHaveCount(0)
    await clickChoice(page, questions[1], false)
    await page.getByRole('button', { name: 'Skip', exact: true }).click()
    await result(page)
    await expect(page.locator('.score-card').first()).toHaveText(game === 'classic-80-in-8' ? '-1Points' : '0Points')
    await expect(page.locator('.review-list details')).toHaveCount(3)
    await page.locator('.review-list summary').first().click()
    await expect(page.locator('.review-list details[open] .solution')).toContainText('Correct · 1 point')
  })
}

test('Intervals draws two boards, accepts steppers and exact bounds, and grades timeout once', async ({ page }, info) => {
  await page.clock.install()
  const c = create([{ ...quant('intervals', 2, 30, 5), families: ['dice-grid', 'scaled-path'] }], 'interval-e2e')
  const qs = plannedQuestions(c, 0) as Extract<Question, { kind: 'interval' }>[]
  await start(page, c)
  await expect(page.locator('.visual')).toBeVisible()
  await page.screenshot({ path: info.outputPath('interval-first.png'), fullPage: true })
  await page.getByRole('button', { name: 'Increase lower bound' }).click()
  await expect(page.getByLabel('Lower bound', { exact: true })).toHaveValue('1')
  const value = Math.floor(F(qs[0].truth).valueOf())
  await page.getByLabel('Lower bound', { exact: true }).fill(String(value))
  await page.getByLabel('Upper bound', { exact: true }).fill(String(value))
  await page.clock.fastForward(5100)
  await expect(page.getByText('2 of 2')).toBeVisible()
  await page.getByLabel('Lower bound', { exact: true }).fill('0')
  await page.getByLabel('Upper bound', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await result(page)
  await expect(page.locator('.score-card').first()).toHaveText('1Points')
})

test('Likelihood-list has equivalent drag and arrow controls and grades exact order', async ({ page }, info) => {
  const c = create([{ ...quant('likelihood-list', 1), families: ['linear-mixtures'] }], 'rank-e2e')
  const q = plannedQuestions(c, 0)[0] as Extract<Question, { kind: 'ranking' }>
  await start(page, c)
  const rows = page.locator('.ranking li')
  const original = await rows.locator(':scope > span').allTextContents()
  await rows.last().scrollIntoViewIfNeeded()
  const source = (await rows.first().locator('svg').first().boundingBox())!
  const target = (await rows.last().locator(':scope > span').boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + 12, target.y + target.height / 2, { steps: 10 })
  await page.mouse.move(target.x + 14, target.y + target.height / 2)
  await page.mouse.up()
  await expect(rows.locator(':scope > span')).toHaveText([original[1], original[2], original[0]])
  for (let index = 0; index < 3; index++) {
    const label = q.options.find(o => o.key === q.truth[index])!.label
    const button = page.getByRole('button', { name: 'Move up · ' + label, exact: true })
    while (await rows.nth(index).locator(':scope > span').textContent() !== label) {
      await button.focus()
      await page.keyboard.press('Enter')
    }
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('likelihood.png'), fullPage: true })
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await result(page)
  await expect(page.locator('.score-card').first()).toHaveText('1Points')
})

test('Orderbooks solves a trade, resets positions, and completes 20 boards in eight minutes', async ({ page }, info) => {
  const c = create([quant('orderbooks', 20, 480)], 'orderbooks-e2e')
  const q = plannedQuestions(c, 0)[0] as Extract<Question, { kind: 'book' }>
  await start(page, c)
  await expect(page.getByText('1 of 20')).toBeVisible()
  await page.getByRole('button', { name: /^Buy for/ }).first().click()
  await expect(page.locator('.has-position')).toHaveCount(1)
  await page.getByRole('button', { name: 'Reset', exact: true }).click()
  await expect(page.locator('.has-position')).toHaveCount(0)
  for (const [index, amount] of q.truth.entries()) {
    const prefix = (amount > 0 ? 'Buy' : 'Sell') + ' for '
    for (let i = 0; i < Math.abs(amount); i++) await page.getByRole('button', { name: new RegExp('^' + prefix + '.*Lot ' + (index + 1) + ' ·') }).click()
  }
  await page.screenshot({ path: info.outputPath('orderbooks.png') })
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  for (let i = 1; i < 20; i++) await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await result(page)
  await expect(page.locator('.score-card').first()).toHaveText('1Points')
  await expect(page.locator('.review-list details')).toHaveCount(20)
})

for (const game of zapIds) test(zapName[game] + ' plays to a real result', async ({ page }, info) => {
  await page.clock.install()
  const c = create([arcade(game, game === 'grill-master' ? 7 : 120)], 'arcade-' + game, 'timed', zapName[game])
  await start(page, c)
  await expect(page.getByRole('region', { name: 'Game board' })).toBeVisible()
  if (game === 'skyscrapers' || game === 'balloon' || game === 'number-box') await page.screenshot({ path: info.outputPath(game + '.png') })
  await playArcade(page, c, 0)
  await result(page, zapName[game])
  await expect(page.locator('.score-card').first()).toHaveText(game === 'balloon' ? '1Cashed out' : '1Correct / solved')
})

test('full mock resumes an active board, persists results, and replays the shared seed', async ({ page }) => {
  await page.clock.install()
  const c = create([
    ...(['beat-the-odds', 'numberlogic', 'likelihood-list', 'intervals', 'orderbooks'] as const).map(game => quant(game, 1)),
    ...defaults.games.map(game => arcade(game)),
  ], 'full-e2e', 'full', 'Full assessment')
  await start(page, c)
  const initial = await page.getByRole('region', { name: 'Question' }).getByRole('heading').textContent()
  for (let i = 0; i < c.stages.length; i++) {
    if (i === 4) {
      await page.getByRole('button', { name: /^Buy for/ }).first().click()
      await page.clock.fastForward(3700)
      await page.reload()
      await expect(page.locator('.has-position')).toHaveCount(1)
      await expect(page.getByRole('timer', { name: 'Section time remaining' })).not.toHaveText('1:20')
    }
    if (c.stages[i].kind === 'quant') await page.getByRole('button', { name: 'Skip', exact: true }).click()
    else await playArcade(page, c, i)
    if (i < c.stages.length - 1) await page.getByRole('button', { name: /^Continue to/ }).click()
  }
  await result(page, 'Full assessment')
  await expect(page.locator('.result-stage')).toHaveCount(c.stages.length)
  await page.getByRole('navigation').getByRole('link', { name: 'History' }).click()
  await expect(page.getByText('Full assessment', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Review', exact: true }).click()
  await result(page, 'Full assessment')
  await start(page, c)
  await expect(page.getByRole('region', { name: 'Question' }).getByRole('heading')).toHaveText(initial ?? '')
})

test.describe('mobile and reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' })

  test('plays a touch orderbook without horizontal overflow and retains focus', async ({ page }, info) => {
    const c = create([quant('orderbooks', 1)], 'mobile-orderbooks', 'practice')
    await start(page, c)
    await expect(page.locator('.order-grid')).toHaveCSS('grid-template-columns', /\d+(\.\d+)?px \d+(\.\d+)?px$/)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.getByRole('button', { name: /^Buy for/ }).first().tap()
    await expect(page.locator('.has-position')).toHaveCount(1)
    await page.getByRole('button', { name: 'Reset', exact: true }).focus()
    await expect(page.getByRole('button', { name: 'Reset', exact: true })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('.has-position')).toHaveCount(0)
    await page.screenshot({ path: info.outputPath('mobile-orderbooks.png'), fullPage: true })
    await page.getByRole('button', { name: 'Skip', exact: true }).tap()
    await page.getByRole('button', { name: 'Next', exact: true }).tap()
    await result(page)
  })
})

test('settings persist, backup imports are validated, and history can be cleared', async ({ page }) => {
  await start(page, create([quant('intervals', 1)], 'settings-e2e'))
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await result(page)
  await page.getByRole('navigation').getByRole('link', { name: 'Settings' }).click()
  await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark')
  await expect(page.getByRole('status')).toHaveText('Preferences saved.')
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'Theme', exact: true })).toHaveValue('dark')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export data' }).click()
  expect((await download).suggestedFilename()).toBe('delta-assessments-backup.json')
  await page.locator('input[type="file"]').setInputFiles({ name: 'corrupt.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
  await expect(page.getByText('This file does not contain valid Delta Assessments data.')).toBeVisible()
  await page.getByRole('button', { name: 'Clear history' }).click()
  await page.getByRole('button', { name: 'Clear saved attempts' }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'History' }).click()
  await expect(page.getByText('No saved runs yet.', { exact: false })).toBeVisible()
})
