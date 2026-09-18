import pytest
import json
from pathlib import Path


class SimulatedGenLayerNode:
    """
    Simulates GenVM execution environment matching GenLayer Studionet specs.
    Tracks state, address balances, timestamps, and JSON-RPC view serializations.
    """
    def __init__(self):
        self.cases = {}
        self.case_ids = []
        self.total_bounty_locked = 0
        self.total_breaches_settled = 0
        self.case_counter = 0
        self.balances = {
            "0xIssuer1": 100 * 10**18,
            "0xWhistleblower1": 10 * 10**18,
            "0xAttacker": 5 * 10**18,
            "0xKeeper": 1 * 10**18,
        }

    def register_nda_escrow(self, issuer: str, value: int, nda_scope: str, duration_seconds: int = 604800, now_timestamp: int = 1770000000) -> str:
        if value <= 0:
            raise ValueError("NDA escrow bounty must be greater than 0 GEN.")
        if not nda_scope or len(nda_scope.strip()) == 0:
            raise ValueError("NDA confidential scope definition cannot be empty.")

        self.case_counter += 1
        case_id = f"nda-{self.case_counter}"
        duration = duration_seconds if duration_seconds > 0 else 604800
        self.cases[case_id] = {
            "case_id": case_id,
            "issuer": issuer,
            "whistleblower": "0x0000000000000000000000000000000000000000",
            "bounty_amount": str(value),
            "reporter_bond": "0",
            "nda_scope": nda_scope.strip(),
            "evidence_url": "",
            "status": 0,  # ACTIVE_SECURE
            "verdict": "PENDING",
            "reason": "NDA active. Awaiting leak evidence or contract expiration.",
            "confidence": 0,
            "leak_severity": 0,
            "created_at_timestamp": str(now_timestamp),
            "expires_at_timestamp": str(now_timestamp + duration),
            "audit_started_at": str(0),
        }
        self.case_ids.append(case_id)
        self.total_bounty_locked += value
        self.balances[issuer] -= value
        return case_id

    def report_leak(self, whistleblower: str, case_id: str, evidence_url: str, bond_value: int, now_timestamp: int = 1770000000) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if c["status"] != 0:
            raise ValueError(f"Case {case_id} is not in ACTIVE_SECURE status.")
        clean_url = evidence_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise ValueError("Valid public leak evidence URL (http/https) is required.")

        min_bond = max(1, int(c["bounty_amount"]) // 20)
        if bond_value < min_bond:
            raise ValueError(f"Whistleblower must stake anti-spam bond of at least {min_bond} wei.")

        c["whistleblower"] = whistleblower
        c["evidence_url"] = clean_url
        c["reporter_bond"] = str(bond_value)
        c["status"] = 1  # IN_AUDIT
        c["audit_started_at"] = str(now_timestamp)
        c["reason"] = "Leak report filed with staked bond. AI jury investigating disclosure."
        self.balances[whistleblower] -= bond_value

    def adjudicate_leak(self, case_id: str, verdict: str, reason: str, confidence: int, severity: int) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if c["status"] != 1:
            raise ValueError(f"Case {case_id} is not awaiting leak adjudication.")

        c["verdict"] = verdict
        c["reason"] = reason
        c["confidence"] = confidence
        c["leak_severity"] = severity
        bounty = int(c["bounty_amount"])
        bond = int(c["reporter_bond"])
        c["reporter_bond"] = "0"

        if verdict == "BREACH_CONFIRMED":
            c["status"] = 2  # BREACH_CONFIRMED
            self.total_bounty_locked -= bounty
            self.total_breaches_settled += 1
            # Payout bounty + refund anti-spam bond to whistleblower
            self.balances[c["whistleblower"]] += (bounty + bond)
        else:
            # Slashed bond compensates issuer, reset to ACTIVE_SECURE
            c["status"] = 0
            c["verdict"] = "NO_BREACH"
            self.balances[c["issuer"]] += bond

    def close_and_reclaim(self, sender: str, case_id: str, current_timestamp: int = 1770605000) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if sender != c["issuer"]:
            raise PermissionError("Only the NDA issuer can reclaim funds.")

        if c["status"] == 1:
            if current_timestamp < (int(c["audit_started_at"]) + 86400):
                raise ValueError("Cannot reclaim: Case is currently undergoing active jury audit (24h protection).")
            bond = int(c["reporter_bond"])
            c["reporter_bond"] = "0"
            if bond > 0:
                self.balances[c["whistleblower"]] += bond
        elif c["status"] == 0:
            if current_timestamp < int(c["expires_at_timestamp"]):
                raise ValueError("Cannot reclaim: Protected NDA confidentiality duration has not yet expired.")
        else:
            raise ValueError("Case is already settled or reclaimed.")

        c["status"] = 3  # SECURE_EXPIRED
        c["verdict"] = "SECURE_EXPIRED"
        c["reason"] = "Protected period expired with zero confirmed leaks. Funds reclaimed by issuer."
        bounty = int(c["bounty_amount"])
        self.total_bounty_locked -= bounty
        self.balances[sender] += bounty

    # View methods matching contract.py JSON string output
    def get_case(self, case_id: str) -> str:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        return json.dumps(self.cases[case_id])

    def get_all_cases(self) -> str:
        res = [self.cases[cid] for cid in self.case_ids]
        return json.dumps(res)

    def get_cases_paginated(self, offset: int, limit: int) -> str:
        total = len(self.case_ids)
        if offset < 0 or offset >= total or limit <= 0:
            return json.dumps([])
        end = min(offset + limit, total)
        res = [self.cases[self.case_ids[i]] for i in range(offset, end)]
        return json.dumps(res)

    def get_stats(self) -> str:
        return json.dumps({
            "total_cases": len(self.case_ids),
            "total_bounty_locked": str(self.total_bounty_locked),
            "total_breaches_settled": self.total_breaches_settled,
        })


# --- Comprehensive Task-based Automated Tests ---

def test_task_1_issuer_creates_docket_and_frontend_schema():
    """Task 1: Issuer registers docket, locks bounty, and JSON matches frontend NDACaseData schema."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        nda_scope="Proprietary AI Weight Compression Algorithm v4. Canary: CANARY_ALPHA_COMPRESS_7781",
        duration_seconds=2592000,
        now_timestamp=1770000000
    )

    # 1. Verify JSON-RPC return format
    raw_case = node.get_case(cid)
    data = json.loads(raw_case)

    # Required fields matching frontend interface NDACaseData
    required_keys = [
        "case_id", "issuer", "whistleblower", "bounty_amount",
        "reporter_bond", "nda_scope", "evidence_url", "status",
        "verdict", "reason", "confidence", "leak_severity",
        "created_at_timestamp", "expires_at_timestamp"
    ]
    for k in required_keys:
        assert k in data, f"Missing key {k} in NDACaseData schema"

    assert data["case_id"] == "nda-1"
    assert data["issuer"] == "0xIssuer1"
    assert data["status"] == 0
    assert data["verdict"] == "PENDING"
    assert data["bounty_amount"] == str(bounty_wei)
    assert int(data["expires_at_timestamp"]) == 1770000000 + 2592000

    # 2. Verify StatsBar schema
    stats = json.loads(node.get_stats())
    assert stats["total_cases"] == 1
    assert stats["total_bounty_locked"] == str(bounty_wei)
    assert stats["total_breaches_settled"] == 0


def test_task_2_whistleblower_reports_leak_with_anti_spam_bond():
    """Task 2: Whistleblower submits leak URL with 5% bond. Docket transitions to IN_AUDIT."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "Confidential trade secrets.")

    bond_wei = int(bounty_wei * 0.05)  # 0.5 GEN
    initial_wb_bal = node.balances["0xWhistleblower1"]

    node.report_leak(
        whistleblower="0xWhistleblower1",
        case_id=cid,
        evidence_url="https://github.com/leaked-repo/leak-mirror-canary-7781",
        bond_value=bond_wei,
        now_timestamp=1770000100
    )

    # Verify balance was deducted for bond
    assert node.balances["0xWhistleblower1"] == initial_wb_bal - bond_wei

    # Verify case status updated to IN_AUDIT
    data = json.loads(node.get_case(cid))
    assert data["status"] == 1
    assert data["whistleblower"] == "0xWhistleblower1"
    assert data["reporter_bond"] == str(bond_wei)
    assert data["evidence_url"] == "https://github.com/leaked-repo/leak-mirror-canary-7781"
    assert "AI jury investigating" in data["reason"]


def test_task_3_ai_jury_breach_confirmed_and_payout():
    """Task 3: AI Jury confirms breach -> Whistleblower receives full bounty + bond refund."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    bond_wei = 5 * 10**17  # 0.5 GEN
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "AI secrets.")
    node.report_leak("0xWhistleblower1", cid, "https://pastebin.com/leak123", bond_wei)

    wb_bal_before_adjudicate = node.balances["0xWhistleblower1"]

    # AI Jury convenes and confirms breach
    node.adjudicate_leak(
        case_id=cid,
        verdict="BREACH_CONFIRMED",
        reason="Semantic analysis verified unauthorized publication containing exact canary secret.",
        confidence=96,
        severity=92
    )

    # Whistleblower receives bounty (10 GEN) + refunded bond (0.5 GEN)
    assert node.balances["0xWhistleblower1"] == wb_bal_before_adjudicate + bounty_wei + bond_wei

    data = json.loads(node.get_case(cid))
    assert data["status"] == 2  # BREACH_CONFIRMED
    assert data["verdict"] == "BREACH_CONFIRMED"
    assert data["confidence"] == 96
    assert data["leak_severity"] == 92
    assert data["reporter_bond"] == "0"

    # Stats updated
    stats = json.loads(node.get_stats())
    assert stats["total_breaches_settled"] == 1
    assert stats["total_bounty_locked"] == "0"


def test_task_4_false_alarm_bond_slashed_to_issuer():
    """Task 4: AI rules NO_BREACH -> Whistleblower bond is slashed to compensate Issuer."""
    node = SimulatedGenLayerNode()
    bounty_wei = 5 * 10**18
    bond_wei = 25 * 10**16  # 0.25 GEN
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "Patent formula.")
    node.report_leak("0xWhistleblower1", cid, "https://news.com/unrelated", bond_wei)

    issuer_bal_before = node.balances["0xIssuer1"]

    # AI Jury concludes no breach
    node.adjudicate_leak(
        case_id=cid,
        verdict="NO_BREACH",
        reason="Submitted article discusses general industry trends, no confidential formula disclosed.",
        confidence=98,
        severity=5
    )

    # Issuer is compensated with slashed bond
    assert node.balances["0xIssuer1"] == issuer_bal_before + bond_wei

    data = json.loads(node.get_case(cid))
    assert data["status"] == 0  # Resets to ACTIVE_SECURE
    assert data["verdict"] == "NO_BREACH"
    assert data["reporter_bond"] == "0"


def test_task_5_dead_404_url_anti_dos_slashing():
    """Task 5: Dead/404 URL fails render -> ruled NO_BREACH and slashed to prevent DoS spam loop."""
    node = SimulatedGenLayerNode()
    bounty_wei = 4 * 10**18
    bond_wei = 2 * 10**17
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "Secret blueprints.")
    node.report_leak("0xAttacker", cid, "https://dead-404-site.invalid/leak", bond_wei)

    attacker_bal_before = node.balances["0xAttacker"]
    issuer_bal_before = node.balances["0xIssuer1"]

    # Render failure produces NO_BREACH
    node.adjudicate_leak(
        case_id=cid,
        verdict="NO_BREACH",
        reason="Could not access or render leak evidence URL. Evidence is missing, invalid, or 404.",
        confidence=100,
        severity=0
    )

    # Attacker loses bond, issuer receives compensation
    assert node.balances["0xAttacker"] == attacker_bal_before
    assert node.balances["0xIssuer1"] == issuer_bal_before + bond_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 0


def test_task_6_expiration_and_safe_reclaim():
    """Task 6: Term expires without breach -> Issuer reclaims 100% escrowed bounty."""
    node = SimulatedGenLayerNode()
    bounty_wei = 2 * 10**18
    duration = 7 * 86400  # 7 days
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "Temporary project NDA.", duration_seconds=duration, now_timestamp=1770000000)

    # Premature reclaim blocked
    with pytest.raises(ValueError, match="confidentiality duration has not yet expired"):
        node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 86400)

    # Reclaim after expiry succeeds
    issuer_bal_before = node.balances["0xIssuer1"]
    node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + duration + 10)

    assert node.balances["0xIssuer1"] == issuer_bal_before + bounty_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 3  # SECURE_EXPIRED
    assert data["verdict"] == "SECURE_EXPIRED"


def test_task_7_stalled_audit_timeout_protection():
    """Task 7: Audit stalled for >24 hours allows reclaim with bond refunded to whistleblower."""
    node = SimulatedGenLayerNode()
    bounty_wei = 3 * 10**18
    bond_wei = 15 * 10**16
    cid = node.register_nda_escrow("0xIssuer1", bounty_wei, "Stalled audit case.", now_timestamp=1770000000)
    node.report_leak("0xWhistleblower1", cid, "https://stalled-test.org", bond_wei, now_timestamp=1770000000)

    # Within 24h: blocked
    with pytest.raises(ValueError, match="24h protection"):
        node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 40000)

    # After 25 hours (90000s): allowed
    wb_bal_before = node.balances["0xWhistleblower1"]
    issuer_bal_before = node.balances["0xIssuer1"]

    node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 90000)

    # Whistleblower gets bond back; Issuer gets bounty back
    assert node.balances["0xWhistleblower1"] == wb_bal_before + bond_wei
    assert node.balances["0xIssuer1"] == issuer_bal_before + bounty_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 3


def test_task_8_pagination_and_all_cases_sync():
    """Task 8: Verify get_all_cases and get_cases_paginated match frontend consumption."""
    node = SimulatedGenLayerNode()
    cids = []
    for i in range(5):
        cids.append(node.register_nda_escrow("0xIssuer1", (i + 1) * 10**18, f"Scope item {i+1}"))

    # Test get_all_cases
    all_cases = json.loads(node.get_all_cases())
    assert len(all_cases) == 5
    assert [c["case_id"] for c in all_cases] == cids

    # Test get_cases_paginated
    page1 = json.loads(node.get_cases_paginated(0, 2))
    assert len(page1) == 2
    assert page1[0]["case_id"] == "nda-1"
    assert page1[1]["case_id"] == "nda-2"

    page2 = json.loads(node.get_cases_paginated(2, 2))
    assert len(page2) == 2
    assert page2[0]["case_id"] == "nda-3"
    assert page2[1]["case_id"] == "nda-4"

    page3 = json.loads(node.get_cases_paginated(4, 2))
    assert len(page3) == 1
    assert page3[0]["case_id"] == "nda-5"
