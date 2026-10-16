# ActionWatch

## Canlı demonun kapsamı

[Demoyu aç](https://action-watch-buse.sleek-brush-8818.chatgpt.site)

GitHub modu herkese açık depoların gerçek Actions verisini salt okunur olarak alır. Örnek modu kurgusal kayıtlar kullanır ve GitHub isteği yapmaz. Özel depo erişimi sunulmaz.

[![ActionWatch checks](https://github.com/busrabuseucar/action-watch/actions/workflows/ci.yml/badge.svg)](https://github.com/busrabuseucar/action-watch/actions/workflows/ci.yml)

A read-only GitHub Actions dashboard for public repositories, built with **TypeScript** and the GitHub REST API. Inspect recent runs, filter results and open the exact run attempt or failed job on GitHub.

**Live demo:** [ActionWatch](https://action-watch-buse.sleek-brush-8818.chatgpt.site). The hosted demo is public and can be opened by anyone with the link. It starts in a clearly labeled fictional sample mode; choose a public repository to load real GitHub data.

## MVP

- Repository input accepts `owner/repository` or a canonical HTTPS GitHub repository URL.
- Fetches the newest 30 workflow runs, with status, conclusion, workflow, branch, commit, event and actor.
- Filters the loaded records by result group, workflow identity and branch.
- Displays job and step results for the **selected run attempt**, including exact job durations when available.
- Links to that run attempt and each job on GitHub. The app never downloads raw log archives.
- Shows a clearly labeled fictional sample with a failed test and its correction. Sample records have no pretend GitHub links.
- Handles missing/private repositories, forbidden responses, API limits, timeouts, invalid payloads and network failure.
- Aborts old requests and ignores stale results when the selected repository, run or mode changes.
- Uses a bounded 60-second memory cache and manual refresh. No automatic polling, login, token input, storage or server proxy.

The app starts in **sample mode** with no GitHub requests. Choose one of the project shortcuts or enter your own public repository to load live data. If an API request fails, the error remains visible and you can explicitly switch to the sample; synthetic results are never presented as live data.

## Local setup

Requirements: **Node.js 24+**, npm, Python 3.10+, and a current browser. TypeScript 5.9.3 and Playwright 1.58.2 are pinned development dependencies; there are no runtime dependencies or API keys.

```bash
git clone https://github.com/busrabuseucar/action-watch.git
cd action-watch
npm ci
npm run build
npm run source
npm start
```

Open **http://localhost:8080**. Stop the local server with Ctrl+C. Serve the built `dist/` directory over HTTP; do not open the HTML directly as a local file. Relative asset URLs also support hosting under a subdirectory. Rebuild after changing TypeScript or public assets. The build clears generated output; regenerate the source ZIP after building.

## How the numbers work

The overview uses all loaded runs, independently of list filters:

| Group | Included values |
| --- | --- |
| Success | `status=completed` and `conclusion=success` |
| Failure | Completed `failure`, `timed_out`, `action_required`, `startup_failure` |
| Active | `queued`, `in_progress`, `waiting`, `pending`, `requested` |
| Other | Cancelled, skipped, neutral, stale, unknown or incomplete outcomes |

**Success rate = success / (success + failure)**. An empty denominator displays a dash. Active and Other records never inflate success. This statistic describes the loaded sample, not the full repository history, reliability, test coverage or code quality.

The bundled example has **8 runs: 4 success, 2 failure, 1 active, 1 cancelled**. Its rounded success rate is **67%** over 6 evaluated results. Run #47 has a failed test; #48 demonstrates the correction. Those records are fictional and dated 4 September 2026. Timestamps are displayed in the browser's local timezone.

Job duration uses the actual `started_at` and `completed_at` fields. Unknown or negative durations are not invented. Workflow duration is not estimated from `updated_at`.

## API and privacy

The application issues only `GET` requests to `https://api.github.com`, with `credentials: omit`, no authorization token and no page referrer. It pins API version `2026-03-10`.

- `GET /repos/{owner}/{repo}/actions/runs?per_page=30&page=1`
- `GET /repos/{owner}/{repo}/actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100&page=N`

Repository text is validated before constructing URLs. Links are generated from the known GitHub origin and validated numeric IDs; API-supplied URLs are not trusted. API text is inserted using `textContent`, not HTML.

At most 3 job pages / 300 jobs are requested for one selection. If more jobs exist, the panel explicitly marks the list as partial. Each response is capped at 4 MiB; each request times out after 12 seconds. Successful validated responses are cached in memory for 60 seconds, without extending their lifetime on reads. The cache holds at most 30 response entries. Refreshing bypasses the cache; the refresh button has a 15-second cooldown. Other user actions can still consume requests.

The app has no automatic retries. Rate headers and `Retry-After`, when visible to the browser, inform the user. Public unauthenticated REST calls normally share a **60 requests/hour/IP** primary quota; other apps or people using the same network can consume it. Secondary limits and access restrictions may also apply. See [GitHub rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

No browser storage, third-party analytics or background monitoring is used. When you choose live mode, GitHub receives your request and IP address. Refreshing or closing the tab discards the app's in-memory state. This MVP supports public GitHub.com repositories only.

The endpoint permissions and browser access model follow [workflow runs](https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs-for-a-repository), [jobs for a run attempt](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run-attempt), and [GitHub CORS documentation](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests), reviewed 4 September 2026.

## Verification

```bash
npm run check
npm run build
npm test
npm run source
node scripts/check-assets.mjs
python3 -m unittest discover -s tests -p 'test_*.py'
npx playwright install chromium
npm run test:browser
```

**31 Node tests** cover outcome grouping, percentage denominators, filters, input validation, strict payload normalization, safe links, actual step durations, attempt-specific pagination, truncation, cache expiry, HTTP errors, rate limits, cancellation, stale selection protection, timeouts and oversized responses. Network error cases use injected test responses and do not consume GitHub quota.

The production API client was also run against the live `busrabuseucar/csv-doctor` repository without an authorization token, using the execution environment's network proxy. It successfully read a workflow run and the jobs for its selected attempt. The normalizers were independently checked against real responses obtained through the connected GitHub reader. That historical check is separate from the deterministic tests below.

One Python test checks source packaging against environment files, private data and symlinks. Six Chromium checks (three flows each on desktop and Pixel 7 emulation) exercise subdirectory hosting, sample filtering, success-rate calculations, safe rendering of API text, exact-attempt job requests and explicit recovery from API errors. Browser API responses are mocked; these tests do not verify GitHub availability, live CORS or real-device behavior.

The main GitHub Actions workflow runs dependency installation, strict TypeScript checking, build, Node/Python tests, source packaging, asset verification and Chromium tests after each push. Failed browser runs retain traces as workflow artifacts.

## CI learning lab

The independent `CI learning lab` workflow is manual. It is not part of the normal check workflow. After publishing this repository, run it once with `broken` and once with `fixed` to produce a real red/green comparison:

```bash
node examples/ci-lab.mjs broken  # expected exit 1
node examples/ci-lab.mjs fixed   # expected exit 0
```

The broken example incorrectly treats a cancelled run as success. It never changes application code, a deployed Site or another repository. Use the manually triggered workflow to compare the broken and fixed scenarios. The app's bundled fictional scenario remains separate from real Actions history.

## Project layout

```text
src/domain.ts      Data types, validation, status grouping and metrics
src/github.ts      Read-only API client, bounds, errors and cache
src/session.ts     Cancellation and stale-response protection
src/sample.ts      Clearly fictional demonstration data
src/app.ts         Interface state, events and safe rendering
public/            HTML shell, stylesheet and favicon
tests/             Node, Python packaging and Chromium integration tests
examples/          Isolated red/green learning exercise
scripts/           Build, portable source ZIP and asset checks
```

`dist/` and `node_modules/` are generated and ignored by Git. The downloadable source ZIP contains TypeScript, assets, tests, docs and build instructions; an explicit path/extension allowlist excludes environment files, private JSON/databases, symlinks, Site identity, dependencies and generated build output. This is not a secret scanner: do not put credentials in allowed source files. Run the local setup sequence after extracting it.

## Scope and attribution

Personal portfolio project for **Büşra Buse Uçar**. No AI model is used at runtime.

This is a bounded monitoring MVP. It does not start, cancel or retry workflows; edit repositories; authenticate users; access private repositories; process raw logs; send alerts; watch in the background; or claim real-time synchronization. MIT license.

## İşletim

[İşletim ve sürüm doğrulama](docs/OPERATIONS.md) — kurulum, veri saklama, yayın, geri dönüş ve doğrulama kapsamı.
