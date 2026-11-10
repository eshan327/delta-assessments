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

async function clickAtPosition(page: Page, target: ReturnType<Page['getByRole']>) {
  await expect(target).toBeVisible()
  const box = (await target.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

async function start(page: Page, challenge: Challenge, freezeClock = false) {
  await page.goto('./#/challenge?' + shareQuery(challenge))
  const button = page.getByRole('button', { name: 'Start challenge' })
  if (freezeClock) {
    await expect(button).toBeVisible()
    const future = await page.evaluate(() => Date.now() + 60_000)
    await page.clock.pauseAt(future)
    await clickAtPosition(page, button)
    await page.clock.runFor(90)
  } else await button.click()
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
      await page.clock.runFor(item.ready + 20)
      await clickAtPosition(page, page.getByRole('button', { name: /Grill 1, Cooked/ }))
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
        await page.getByRole('button', { name: 'Operator ' + op, exact: true }).click()
        await expect(page.getByRole('button', { name: 'Operator ' + op, exact: true })).toHaveAttribute('aria-pressed', 'true')
        await page.locator('[data-tile="' + b + '"]').click()
      }
      await page.getByRole('button', { name: 'Submit', exact: true }).click()
      break
    }
    case 'code-compare':
      await expect(page.getByLabel('Reference ' + round.reference, { exact: true })).toBeVisible()
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
      await expect(page.locator('.active-stimulus')).toBeVisible()
      await page.keyboard.press(round.answer === 0 ? 'ArrowLeft' : 'ArrowRight')
      break
    case 'shapeshift':
      await page.clock.fastForward(round.delay + 45)
      await expect(page.getByRole('img', { name: round.shape })).toBeVisible()
      await page.keyboard.press(round.answer === 0 ? 'ArrowLeft' : 'ArrowRight')
      break
  }
}

test('homepage groups all Zap-N games and opens each rules page', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto('./')
  await expect(page).toHaveTitle('Optiver Assessments')
  await expect(page.getByText('Independent practice', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Assessments', exact: true }).locator('.game-row strong'))
    .toHaveText(['Beat The Odds', 'NumberLogic', 'Likelihood-list', 'Intervals', 'Orderbooks', 'Classic 80-in-8'])
  await expect(page.getByRole('region', { name: 'Zap-N', exact: true }).locator('.game-row strong')).toHaveText(zapIds.map(id => zapName[id]))
  await expect(page.getByRole('link', { name: /^(About|History|Full mock|Settings)$/ })).toHaveCount(0)
  await page.screenshot({ path: info.outputPath('portal.png'), fullPage: true })
  for (const slug of ['beat-the-odds', 'numberlogic', 'likelihood-list', 'intervals', 'orderbooks', 'classic-80-in-8']) {
    await page.locator('a[href="#/game/' + slug + '"]').click()
    await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Scoring', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start tutorial' })).toBeVisible()
    await page.getByRole('link', { name: 'Assessments', exact: true }).click()
  }
  for (const id of zapIds) {
    await page.locator('a[href="#/game/' + id + '"]').click()
    await expect(page.getByRole('heading', { level: 1, name: zapName[id] })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Zap-N', exact: true }).click()
    await expect(page).toHaveURL(/#\/#zap-n$/)
    await expect(page.getByRole('region', { name: 'Zap-N', exact: true })).toBeVisible()
  }
  await page.goto('./#/zap-n')
  await expect(page).toHaveURL(/#\/#zap-n$/)
  for (const removed of ['full', 'settings']) {
    await page.goto('./#/' + removed)
    await expect(page.getByRole('heading', { name: 'Optiver Assessments' })).toBeVisible()
  }
  await page.goto('./#/game/orderbooks')
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Orderbooks' })).toBeVisible()
  await expect(page.getByText('Make a profit and finish with zero inventory.')).toBeVisible()
  await page.screenshot({ path: info.outputPath('orderbooks-rules.png'), fullPage: true })
  await page.getByRole('button', { name: 'Start tutorial' }).click()
  await expect(page.getByRole('region', { name: 'Question' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await result(page, 'Orderbooks tutorial')
  expect(errors).toEqual([])
})

for (const game of ['beat-the-odds', 'numberlogic', 'classic-80-in-8'] as const) {
  test(game + ' completes a timed correct, wrong, and skipped response', async ({ page }) => {
    const c = create([quant(game, 3)], game + '-e2e')
    const questions = plannedQuestions(c, 0) as Extract<Question, { kind: 'choice' }>[]
    await start(page, c)
    const correct = questions[0].options.findIndex(option => option.key === questions[0].truth)
    const choice = page.getByRole('group', { name: 'Answer choices' }).getByRole('button').nth(correct)
    await expect(choice).toBeEnabled()
    await page.keyboard.press(String(correct + 1))
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await page.keyboard.press('Enter')
    await expect(page.getByText('2 of 3', { exact: true })).toBeVisible()
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

test('stacked fractions remain readable and grade exactly', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const c = create([{ ...quant('classic-80-in-8', 1), families: ['frac-sum'] }], 'stacked-fractions', 'practice')
  const q = plannedQuestions(c, 0)[0] as Extract<Question, { kind: 'choice' }>
  await start(page, c)
  const fraction = page.getByRole('heading', { level: 2 }).getByRole('math').first()
  await expect(fraction).toBeVisible()
  await expect(fraction).toHaveCSS('display', 'inline-grid')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await page.screenshot({ path: info.outputPath('math-notation.png') })
  await clickChoice(page, q, true)
  await expect(page.locator('.solution')).toContainText('Correct · 1 point')
  await expect(page.locator('.solution .math-fraction').first()).toBeVisible()
})

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
  await expect(rows.last()).toHaveAttribute('data-drag', 'target')
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
  await expect(page.getByRole('region', { name: 'Question' }).getByRole('heading')).toHaveCount(0)
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
  await start(page, c, game === 'grill-master')
  await expect(page.getByRole('region', { name: 'Game board' })).toBeVisible()
  if (game === 'skyscrapers' || game === 'balloon' || game === 'number-box') await page.screenshot({ path: info.outputPath(game + '.png') })
  await playArcade(page, c, 0)
  await result(page, zapName[game])
  await expect(page.locator('.score-card').first()).toHaveText(game === 'balloon' ? '1Cashed out' : '1Correct / solved')
})

test('practice exit pauses the clock, saves the active board, and replays its seed', async ({ page }) => {
  await page.clock.install()
  const c = create([quant('orderbooks', 1)], 'practice-resume', 'practice')
  await start(page, c)
  await page.getByRole('button', { name: /^Buy for/ }).first().click()
  await page.getByRole('button', { name: /^Undo buy/ }).click()
  await expect(page.locator('.has-position')).toHaveCount(0)
  await page.getByRole('button', { name: /^Sell for/ }).first().click()
  await page.getByRole('button', { name: 'Exit run' }).click()
  await page.getByRole('link', { name: 'Exit to assessments' }).click()
  await expect(page.getByRole('heading', { name: 'Optiver Assessments' })).toBeVisible()
  await page.clock.fastForward(100_000)
  await page.reload()
  await page.getByRole('link', { name: 'Resume run' }).click()
  await expect(page.getByRole('heading', { name: 'Practice paused' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume practice' }).last().click()
  const quotes = await page.locator('.quote-buttons').allTextContents()
  await expect(page.locator('.has-position')).toHaveCount(1)
  await page.getByRole('button', { name: 'Skip', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await result(page)
  await page.reload()
  await result(page)
  await start(page, c)
  await page.getByRole('button', { name: /^Sell for/ }).first().click()
  await expect(page.locator('.quote-buttons')).toHaveText(quotes)
})

test('old full-mock challenge links cannot start a new run', async ({ page }) => {
  const old = create([quant('numberlogic', 1), arcade('balloon')], 'old-mock', 'full')
  await page.goto('./#/challenge?' + shareQuery(old))
  await expect(page.getByRole('heading', { name: 'Challenge unavailable' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start challenge' })).toHaveCount(0)
})

test.describe('mobile and reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, reducedMotion: 'reduce' })

  test('opens the mobile index and rules without horizontal overflow', async ({ page }, info) => {
    await page.goto('./')
    await expect(page.locator('.game-row')).toHaveCount(15)
    await page.getByRole('link', { name: 'Shapeshift', exact: true }).tap()
    await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'Zap-N', exact: true }).tap()
    await expect(page.getByRole('heading', { name: 'Zap-N', exact: true })).toBeInViewport()
    await expect(page.getByRole('region', { name: 'Zap-N', exact: true })).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.screenshot({ path: info.outputPath('mobile-portal.png'), fullPage: true })
    await page.getByRole('link', { name: 'Intervals', exact: true }).tap()
    await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible()
    await expect(page.getByText('40 ÷ 50 = 80%')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
    await page.screenshot({ path: info.outputPath('mobile-rules.png'), fullPage: true })
    await page.getByRole('button', { name: 'Start timed' }).tap()
    await page.getByRole('button', { name: 'Exit run' }).tap()
    await page.getByRole('link', { name: 'Exit to assessments' }).tap()
    await expect(page.getByRole('link', { name: 'Resume run' })).toBeVisible()
    const title = (await page.locator('.folio-cover h1').boundingBox())!
    const controls = (await page.locator('.folio-cover .actions').boundingBox())!
    expect(controls.y).toBeGreaterThanOrEqual(title.y + title.height)
  })

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
