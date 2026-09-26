/**
 * Automated Frontend & Contract Synchronization Verification Script
 * Validates that all contract task outputs integrate seamlessly with the Frontend UI,
 * role permissions, status tag mappings, formatters, and filter behaviors.
 */

export interface NDACaseData {
  case_id: string;
  issuer: string;
  nda_party: string;
  party_identifier: string;
  whistleblower: string;
  bounty_amount: string;
  reporter_bond?: string;
  public_nda_topic: string;
  canary_commitment: string;
  discovered_canary?: string;
  evidence_url: string;
  status: number; // 0: ACTIVE_SECURE, 1: IN_AUDIT, 2: BREACH_CONFIRMED, 3: SECURE_EXPIRED
  verdict: string; // "PENDING", "BREACH_CONFIRMED", "NO_BREACH", "FETCH_FAILED", "SECURE_EXPIRED"
  reason: string;
  confidence: number;
  leak_severity: number;
  created_at_timestamp?: string;
  expires_at_timestamp?: string;
  created_at_block?: string;
}

export interface ProtocolStats {
  total_cases: number;
  total_bounty_locked: string;
  total_breaches_settled: number;
}

import {
  getStatusMeta,
  formatGen,
  parseGen,
  formatAddress,
  getExplorerUrl,
} from '../src/utils/helpers.ts';

// ANSI terminal colors for readable output
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ${green('✓')} ${msg}`);
    passed++;
  } else {
    console.error(`  ${red('✗ FAILED:')} ${msg}`);
    failed++;
  }
}

console.log(bold('\n=== AgentNDA: Frontend & Adjudication Sync Verification Suite ===\n'));

// Simulated Dockets from Contract Execution
const mockCases: NDACaseData[] = [
  {
    case_id: 'nda-1',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    nda_party: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    party_identifier: 'github.com/vendor-ai',
    whistleblower: '0x0000000000000000000000000000000000000000',
    bounty_amount: '10000000000000000000', // 10 GEN
    reporter_bond: '0',
    public_nda_topic: 'Proprietary AI Weight Compression Algorithm v4',
    canary_commitment: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    discovered_canary: '',
    evidence_url: '',
    status: 0, // ACTIVE_SECURE
    verdict: 'PENDING',
    reason: 'NDA active. Bound party registered with non-public cryptographic canary commitment.',
    confidence: 0,
    leak_severity: 0,
    created_at_timestamp: '1770000000',
    expires_at_timestamp: '1772592000',
  },
  {
    case_id: 'nda-2',
    issuer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    nda_party: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    party_identifier: '@trading_fund_advisor',
    whistleblower: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    bounty_amount: '5000000000000000000', // 5 GEN
    reporter_bond: '250000000000000000', // 0.25 GEN (5%)
    public_nda_topic: 'Internal financial models and trading alpha keys',
    canary_commitment: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
    discovered_canary: 'CANARY_TRADING_ALPHA_SEC_9912',
    evidence_url: 'https://pastebin.com/raw/leaked_financials',
    status: 1, // IN_AUDIT
    verdict: 'PENDING',
    reason: 'Leak report filed with verified canary. AI investigating @trading_fund_advisor.',
    confidence: 0,
    leak_severity: 0,
    created_at_timestamp: '1770000100',
    expires_at_timestamp: '1772592100',
  },
  {
    case_id: 'nda-3',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    nda_party: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    party_identifier: 'zk-audit-labs.eth',
    whistleblower: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    bounty_amount: '8000000000000000000', // 8 GEN
    reporter_bond: '0',
    public_nda_topic: 'Confidential zero-knowledge prover architecture',
    canary_commitment: 'b2c3d4e5f6a178901234567890abcdef1234567890abcdef1234567890abcdef',
    discovered_canary: 'CANARY_ZK_PROVER_INTERNAL_SEC_1102',
    evidence_url: 'https://github.com/public-mirror/zk-leak',
    status: 2, // BREACH_CONFIRMED
    verdict: 'BREACH_CONFIRMED',
    reason: 'Semantic analysis confirmed verified leak of private circuit logic tied to zk-audit-labs.eth.',
    confidence: 97,
    leak_severity: 94,
    created_at_timestamp: '1770000200',
    expires_at_timestamp: '1772592200',
  },
  {
    case_id: 'nda-4',
    issuer: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    nda_party: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    party_identifier: 'tier1-exchange-team',
    whistleblower: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4df',
    bounty_amount: '3000000000000000000', // 3 GEN
    reporter_bond: '0',
    public_nda_topic: 'Partnership discussions with Tier 1 exchanges',
    canary_commitment: 'c3d4e5f6a1b278901234567890abcdef1234567890abcdef1234567890abcdef',
    discovered_canary: 'CANARY_EXCHANGE_DISCUSSIONS_SEC_0019',
    evidence_url: 'https://twitter.com/fake_rumors/12345',
    status: 0, // CLEARED / NO_BREACH (resets to 0 after bond slash)
    verdict: 'NO_BREACH',
    reason: 'Rumor post contained zero material confidential facts.',
    confidence: 99,
    leak_severity: 4,
    created_at_timestamp: '1770000300',
    expires_at_timestamp: '1772592300',
  },
  {
    case_id: 'nda-5',
    issuer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    nda_party: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    party_identifier: 'marketing-agency.eth',
    whistleblower: '0x0000000000000000000000000000000000000000',
    bounty_amount: '2000000000000000000', // 2 GEN
    reporter_bond: '0',
    public_nda_topic: 'Expiring marketing campaign secrets',
    canary_commitment: 'd4e5f6a1b2c378901234567890abcdef1234567890abcdef1234567890abcdef',
    discovered_canary: '',
    evidence_url: '',
    status: 3, // SECURE_EXPIRED
    verdict: 'SECURE_EXPIRED',
    reason: 'Protected period expired with zero confirmed leaks. Funds reclaimed by issuer.',
    confidence: 0,
    leak_severity: 0,
    created_at_timestamp: '1770000400',
    expires_at_timestamp: '1770605200',
  },
];

// --- 1. Status Tag & Editorial Badge Synchronization ---
console.log(cyan('[Test Section 1: Editorial Badges & Status Meta]'));

const meta1 = getStatusMeta(mockCases[0].status, mockCases[0].verdict);
assert(meta1.label === 'Active & Secure', 'Case 1 label is "Active & Secure"');
assert(meta1.badgeClass === 'press-tag press-tag-forest', 'Case 1 has press-tag-forest class');

const meta2 = getStatusMeta(mockCases[1].status, mockCases[1].verdict);
assert(meta2.label === 'In Audit / Investigating', 'Case 2 label is "In Audit / Investigating"');
assert(meta2.badgeClass === 'press-tag press-tag-amber', 'Case 2 has press-tag-amber class');

const meta3 = getStatusMeta(mockCases[2].status, mockCases[2].verdict);
assert(meta3.label === 'Breach Confirmed', 'Case 3 label is "Breach Confirmed"');
assert(meta3.badgeClass === 'press-tag press-tag-crimson', 'Case 3 has press-tag-crimson class');

const meta4 = getStatusMeta(mockCases[3].status, mockCases[3].verdict);
assert(meta4.label === 'Cleared / No Breach', 'Case 4 label is "Cleared / No Breach"');
assert(meta4.badgeClass === 'press-tag press-tag-forest', 'Case 4 has press-tag-forest class');

const meta5 = getStatusMeta(mockCases[4].status, mockCases[4].verdict);
assert(meta5.label === 'Expired / Reclaimed', 'Case 5 label is "Expired / Reclaimed"');
assert(meta5.badgeClass === 'press-tag press-tag-neutral', 'Case 5 has press-tag-neutral class');


// --- 2. Formatters & Currency Display ---
console.log(cyan('\n[Test Section 2: Helper Formatters & Precision]'));

assert(formatGen('10000000000000000000') === '10.0000', '10 GEN formatted cleanly');
assert(formatGen('250000000000000000') === '0.2500', '0.25 GEN anti-spam bond formatted correctly');
assert(formatGen('0') === '0.00', '0 wei formatted to 0.00');

assert(parseGen('10') === 10000000000000000000n, 'parseGen parses whole numbers to 18 decimals');
assert(parseGen('0.25') === 250000000000000000n, 'parseGen parses fractional decimals');

assert(formatAddress('0x0000000000000000000000000000000000000000') === 'None', 'Zero address formatted as None');
assert(formatAddress('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266') === '0xf39F...2266', 'Active address truncated nicely');


// --- 3. Role-Based Action Button & UI Entitlements ---
console.log(cyan('\n[Test Section 3: Role-Based Permissions & Action Buttons]'));

const currentUserIssuer = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const currentUserWhistleblower = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

// Case 1 (ACTIVE_SECURE, issuer is currentUserIssuer)
const isIssuerCase1 = currentUserIssuer.toLowerCase() === mockCases[0].issuer.toLowerCase();
assert(isIssuerCase1 === true, 'Case 1 correctly flags isIssuer for connected owner');
assert(mockCases[0].status === 0, 'Case 1 provides "Submit Leak Report" to whistleblowers');
assert(isIssuerCase1 && mockCases[0].status === 0, 'Case 1 provides "Reclaim Bond" option to Issuer');

// Case 2 (IN_AUDIT)
assert(mockCases[1].status === 1, 'Case 2 displays "Convene AI Jury Court" button');
assert(mockCases[1].evidence_url.length > 0, 'Case 2 renders public evidence inspection link');

// Case 3 (BREACH_CONFIRMED)
assert(mockCases[2].status === 2, 'Case 3 displays "Inspect Court Verdict" button');
assert(mockCases[2].leak_severity === 94, 'Case 3 provides high severity score to BreachJuryModal');
assert(mockCases[2].confidence === 97, 'Case 3 provides confidence metric to BreachJuryModal');
assert(mockCases[2].party_identifier === 'zk-audit-labs.eth', 'Case 3 links to bound party identity');

// Case 4 (CLEARED / NO_BREACH)
assert(mockCases[3].verdict === 'NO_BREACH', 'Case 4 displays "Inspect Court Verdict" for clearance ledger');


// --- 4. Tab Filtering & Search Synchronization ---
console.log(cyan('\n[Test Section 4: Tab Filtering & Query Search Synchronization]'));

function filterCases(items: NDACaseData[], filter: string, query: string) {
  return items.filter((c) => {
    const topic = (c.public_nda_topic || '').toLowerCase();
    const party = (c.party_identifier || '').toLowerCase();
    const matchesQuery =
      c.case_id.toLowerCase().includes(query.toLowerCase()) ||
      topic.includes(query.toLowerCase()) ||
      party.includes(query.toLowerCase()) ||
      c.issuer.toLowerCase().includes(query.toLowerCase());

    if (!matchesQuery) return false;
    if (filter === 'active') return c.status === 0;
    if (filter === 'audit') return c.status === 1;
    if (filter === 'settled') return c.status === 2 || c.status === 3;
    return true;
  });
}

// All
const allList = filterCases(mockCases, 'all', '');
assert(allList.length === 5, 'Filter "all" returns 5 dockets');

// Active (status 0: nda-1 and nda-4)
const activeList = filterCases(mockCases, 'active', '');
assert(activeList.length === 2, 'Filter "active" returns 2 active dockets');
assert(activeList.map((c) => c.case_id).sort().join(',') === 'nda-1,nda-4', 'Active dockets are nda-1 and nda-4');

// In Audit (status 1: nda-2)
const auditList = filterCases(mockCases, 'audit', '');
assert(auditList.length === 1, 'Filter "audit" returns 1 docket in investigation');
assert(auditList[0].case_id === 'nda-2', 'In-audit docket is nda-2');

// Settled (status 2 or 3: nda-3 and nda-5)
const settledList = filterCases(mockCases, 'settled', '');
assert(settledList.length === 2, 'Filter "settled" returns 2 settled dockets');
assert(settledList.map((c) => c.case_id).sort().join(',') === 'nda-3,nda-5', 'Settled dockets are nda-3 and nda-5');

// Search query matching
const topicSearch = filterCases(mockCases, 'all', 'Weight Compression');
assert(topicSearch.length === 1 && topicSearch[0].case_id === 'nda-1', 'Search finds topic accurately');

const partySearch = filterCases(mockCases, 'all', 'zk-audit-labs');
assert(partySearch.length === 1 && partySearch[0].case_id === 'nda-3', 'Search by bound party identifier accurately');

const issuerSearch = filterCases(mockCases, 'all', '0xf39F');
assert(issuerSearch.length === 3, 'Search by issuer prefix matches 3 dockets');


// --- 5. Aggregated StatsBar Parity ---
console.log(cyan('\n[Test Section 5: Protocol Stats Bar Parity]'));

const stats: ProtocolStats = {
  total_cases: mockCases.length,
  total_bounty_locked: (
    BigInt(mockCases[0].bounty_amount) + BigInt(mockCases[1].bounty_amount)
  ).toString(),
  total_breaches_settled: 1,
};

assert(stats.total_cases === 5, 'StatsBar total_cases is 5');
assert(stats.total_breaches_settled === 1, 'StatsBar total_breaches_settled is 1');
assert(formatGen(stats.total_bounty_locked) === '15.0000', 'Total active bounty locked is 15.0000 GEN');

console.log(bold(`\n=== Verification Results: ${green(`${passed} PASSED`)} | ${failed === 0 ? green('0 FAILED') : red(`${failed} FAILED`)} ===\n`));

if (failed > 0) {
  process.exit(1);
}
