
import type { Verdict } from './types';
import type { FailedTestEx } from './report';
import type { NetworkCall, TraceEvidence } from './trace';
import { EMPTY_TRACE, readTrace } from './trace';
import { OUT_DIR, findFiles, writeJson } from './util';
import { isMain } from './util';
import { parseReport } from './report';

/** Rung 2 (D4): deterministic signature rules. High-confidence matches are final. */
export const FINAL_CONFIDENCE = 0.8;

export type NextRung = 'stop' | 'crawler' | 'claude';

export interface ClassifierEvidence {
  trace: TraceEvidence;
  /** Origins that count as "the app" (BASE_URL, API_URL). Third-party failures are ignored. */
  appOrigins: string[];
  /** Isolated-rerun result, when rung 1 ran. */
  rerun?: { passed: number; failed: number };
}

export interface Classification {
  verdict: Verdict;
  next: NextRung;
}

const ENV_PATTERNS: [RegExp, string][] = [
  [/net::ERR_[A-Z_]+/, 'network error (net::ERR_*)'],
  [/ENOTFOUND|EAI_AGAIN|getaddrinfo/, 'DNS resolution failed'],
  [/ECONNREFUSED|ECONNRESET|socket hang up/, 'connection refused/reset'],
  [/page\.goto: Timeout|Navigation timeout|waiting for navigation|frame\.goto: Timeout/i, 'navigation timeout'],
  [/\b(502|503|504) (Bad Gateway|Service Unavailable|Gateway Time-?out)/i, 'gateway error on page load'],
  [/\b429\b|Too Many Requests|cf-challenge|Just a moment\.\.\.|Attention Required/i, 'rate limit or bot challenge'],
];

const AUTOMATION_STOP_PATTERNS: [RegExp, string][] = [
  [/Cannot find module|ERR_MODULE_NOT_FOUND|Failed to load|SyntaxError/, 'import or syntax error'],
  [/error TS\d{4}|TS\d{4}:/, 'TypeScript error'],
  [/Invalid environment/, 'invalid environment config'],
  [/ReferenceError|is not a function|is not defined|Cannot read properties of (undefined|null)/, 'test code error'],
  [/fixture|"beforeAll" hook|"beforeEach" hook|"afterAll" hook|"afterEach" hook|setup failed/i, 'fixture or hook error'],
];

const SELECTOR_PATTERNS: [RegExp, string][] = [
  [/strict mode violation/i, 'strict-mode violation (locator matches several elements)'],
  [/element is not attached|detached from (the )?DOM|Element is not attached/i, 'element detached'],
  [/locator\.\w+: Timeout \d+ms exceeded/, 'locator action timeout'],
  [/waiting for (getBy\w+|locator)\(/, 'locator never resolved'],
  [/element\(s\) not found/, 'element not found by assertion'],
  [/Self-heal is not allowed in strict mode/, 'self-heal blocked in strict mode (locator drifted)'],
];

const ASSERTION_PATTERN =
  /expect\((received|locator|page)\)\.(to\w+)|Expected( string| pattern| value)?:|Received( string| value)?:/;

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

export function appRequests(trace: TraceEvidence, appOrigins: string[]): NetworkCall[] {
  const origins = new Set(appOrigins.map(originOf).filter(Boolean));
  if (!origins.size) {
    const firstDoc = trace.network.find((n) => n.resourceType === 'document');
    if (firstDoc) origins.add(originOf(firstDoc.url));
  }
  return trace.network.filter(
    (n) => origins.has(originOf(n.url)) && ['document', 'xhr', 'fetch', ''].includes(n.resourceType),
  );
}

function verdict(f: FailedTestEx, v: Omit<Verdict, 'test' | 'file' | 'line' | 'project' | 'rung'>): Verdict {
  return { test: f.test, file: f.file, line: f.line, project: f.project, rung: 'classifier', ...v };
}

/** Pure rule classifier: same input, same verdict. */
export function classify(f: FailedTestEx, ev: ClassifierEvidence): Classification {
  const text = `${f.error}\n${f.stack ?? ''}`;
  const app = appRequests(ev.trace, ev.appOrigins);
  const app5xx = app.filter((n) => n.status >= 500);
  const docFailures = app.filter((n) => n.resourceType === 'document' && [502, 503, 504].includes(n.status));
  const pageErrors = [
    ...ev.trace.pageErrors,
    ...(f.pageErrorsText ?? '')
      .split('\n')
      .filter((l) => l.startsWith('pageerror:'))
      .map((l) => l.replace(/^pageerror:\s*/, '')),
  ];
  const consoleErrors = [
    ...ev.trace.consoleErrors,
    ...(f.pageErrorsText ?? '')
      .split('\n')
      .filter((l) => l.startsWith('console:'))
      .map((l) => l.replace(/^console:\s*/, '')),
  ];
  const consistent = ev.rerun ? ev.rerun.passed === 0 && ev.rerun.failed >= 3 : false;
  const evidenceBase = [
    `error: ${f.error.split('\n')[0] ?? ''}`,
    ...(ev.rerun ? [`isolated rerun: ${ev.rerun.passed} passed / ${ev.rerun.failed} failed`] : []),
  ];

  // 1. Environment: the product could not be reached.
  for (const [re, label] of ENV_PATTERNS) {
    if (re.test(text)) {
      return {
        verdict: verdict(f, {
          classification: 'environment',
          confidence: 0.9,
          signature: label,
          root_cause: `Environment: ${label}. Rerun later; note in the STP risk section.`,
          evidence: evidenceBase,
        }),
        next: 'stop',
      };
    }
  }
  if (docFailures.length) {
    return {
      verdict: verdict(f, {
        classification: 'environment',
        confidence: 0.85,
        signature: 'gateway error on page load',
        root_cause: `Environment: page load returned ${docFailures.map((d) => d.status).join(', ')}.`,
        evidence: [...evidenceBase, ...docFailures.map((d) => `${d.status} ${d.method} ${d.url}`)],
      }),
      next: 'stop',
    };
  }

  // 2. Automation that must simply be fixed (test code, fixture, config).
  for (const [re, label] of AUTOMATION_STOP_PATTERNS) {
    if (re.test(text) && !/locator\.|expect\(/.test(f.error.split('\n')[0] ?? '')) {
      return {
        verdict: verdict(f, {
          classification: 'automation',
          confidence: 0.9,
          signature: label,
          root_cause: `Automation: ${label}. Fix the test/fixture code.`,
          evidence: evidenceBase,
        }),
        next: 'stop',
      };
    }
  }

  // 3. Product: app 5xx or uncaught page error at the failing step.
  if (app5xx.length || pageErrors.length) {
    const ev2 = [
      ...evidenceBase,
      ...app5xx.slice(0, 5).map((n) => `${n.status} ${n.method} ${n.url}`),
      ...pageErrors.slice(0, 5).map((e) => `pageerror: ${e}`),
    ];
    return {
      verdict: verdict(f, {
        classification: 'product',
        confidence: consistent ? 0.85 : 0.6,
        signature: app5xx.length ? 'app request returned 5xx' : 'uncaught page error',
        root_cause: app5xx.length
          ? `Product: ${app5xx.length} app request(s) returned 5xx during the test.`
          : `Product: uncaught page error during the test.`,
        evidence: ev2,
      }),
      next: consistent ? 'stop' : 'crawler',
    };
  }

  // 4. Selector problems: the crawler looks for the element.
  for (const [re, label] of SELECTOR_PATTERNS) {
    if (re.test(text)) {
      return {
        verdict: verdict(f, {
          classification: 'undecided',
          confidence: 0.6,
          signature: `automation (selector): ${label}`,
          root_cause: `Suspect automation (selector): ${label}. Crawler searches for the target.`,
          evidence: evidenceBase,
        }),
        next: 'crawler',
      };
    }
  }

  // 5. Console errors only: weak product signal.
  if (consoleErrors.length) {
    return {
      verdict: verdict(f, {
        classification: 'undecided',
        confidence: 0.5,
        signature: 'console error at the failing step',
        root_cause: 'Suspect product: console errors during the test. Crawler checks the page.',
        evidence: [...evidenceBase, ...consoleErrors.slice(0, 5).map((e) => `console: ${e}`)],
      }),
      next: 'crawler',
    };
  }

  // 6. Value mismatch with every app response 2xx/3xx: product or test data.
  if (ASSERTION_PATTERN.test(text)) {
    const allOk = app.every((n) => n.status > 0 && n.status < 400);
    return {
      verdict: verdict(f, {
        classification: 'undecided',
        confidence: 0.4,
        signature: allOk ? 'assertion mismatch, all responses 2xx' : 'assertion mismatch',
        root_cause: 'Suspect product or test data: assertion value mismatch. Crawler, then Claude.',
        evidence: evidenceBase,
      }),
      next: 'crawler',
    };
  }

  return {
    verdict: verdict(f, {
      classification: 'undecided',
      confidence: 0.2,
      signature: 'unknown',
      root_cause: 'No rule matched.',
      evidence: evidenceBase,
    }),
    next: 'claude',
  };
}

export function defaultAppOrigins(): string[] {
  return [process.env.BASE_URL, process.env.API_URL].filter((u): u is string => Boolean(u));
}

export function evidenceFor(f: FailedTestEx, rerun?: { passed: number; failed: number }): ClassifierEvidence {
  return {
    trace: f.tracePath ? readTrace(f.tracePath) : { ...EMPTY_TRACE },
    appOrigins: defaultAppOrigins(),
    ...(rerun ? { rerun } : {}),
  };
}

/* CLI: npm run triage:classify -- [report file or dir]  → triage/out/verdicts.json */
function main(): Promise<void> {
  const src = process.argv[2] ?? 'test-results/results.json';
  const failed = findFiles(src, 'results.json').flatMap(parseReport);
  const verdicts = failed.map((f) => classify(f, evidenceFor(f)).verdict);
  writeJson(`${OUT_DIR}/verdicts.json`, verdicts);
  for (const v of verdicts) console.log(`${v.classification.padEnd(11)} ${v.confidence.toFixed(2)}  ${v.test}`);
  console.log(`\n${verdicts.length} verdict(s) → ${OUT_DIR}/verdicts.json`);
  return Promise.resolve();
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
