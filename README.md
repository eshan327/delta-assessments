# Delta Assessments

Optiver Assessments is an independent, browser-based practice site for quantitative assessments and cognitive games. Practice provides feedback as you play. Timed sections reveal solutions when the clock or question set ends.

The library contains Beat The Odds, NumberLogic, Likelihood-list, Intervals, Orderbooks, and the Zap-N arcade. All nine Zap-N games can be played independently. Classic 80-in-8 is a separate mental-math trainer.

## Run locally

Requires Node.js 26 and npm.

    npm ci
    npm run dev

Open the local URL with the /delta-assessments/ prefix. A production build uses the same prefix and hash-based routes.

## Play and share

Start with a tutorial, choose Practice or Timed, or set a custom duration, difficulty, and question mix. Runs are stored in your browser.

After a run, choose **Retake with new seed** for fresh content or **Copy challenge link** to reproduce the exact question order and settings on another device. The challenge encodes the generator version.

## Verify

    npm run typecheck
    npm run lint
    npm test
    npm run qa:generators
    npm run qa:deep
    npm run build
    npx playwright install chromium webkit
    npm run test:e2e

Generator QA writes a local qa-report.json with family coverage, solver checks, ambiguity margins, and fingerprint counts. Browser tests use the production build and cover both rendering and real inputs. The engine in src/engine owns generation, scoring, clocks, and persistence. The screens in src/games render the same question data the solvers verify.

## Deploy

Set the repository’s Pages source to **GitHub Actions**. A successful CI run for a push to main triggers the Pages build and deployment for the same commit. The Pages workflow can also be run manually from main, with the same verification gate.
