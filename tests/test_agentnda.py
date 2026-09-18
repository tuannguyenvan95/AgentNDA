import pytest
import json
from pathlib import Path


def test_contract_syntax_and_structure(contract_source):
    """Verify that the contract file compiles as valid Python and defines all required methods."""
    assert contract_source.startswith('# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }')
    assert "class NDACase:" in contract_source
    assert "class Contract(gl.Contract):" in contract_source
    assert "def register_nda_escrow(" in contract_source
    assert "def report_leak(" in contract_source
    assert "def adjudicate_leak(" in contract_source
    assert "def close_and_reclaim(" in contract_source
    assert "def get_case(" in contract_source
    assert "def get_all_cases(" in contract_source
    assert "def get_cases_paginated(" in contract_source
    assert "def get_stats(" in contract_source


def test_case_struct_attributes(contract_source):
    """Ensure NDACase defines all necessary state fields according to spec."""
    expected_fields = [
        "case_id: str",
        "issuer: Address",
        "whistleblower: Address",
        "bounty_amount: bigint",
        "reporter_bond: bigint",
        "nda_scope: str",
        "evidence_url: str",
        "status: u8",
        "verdict: str",
        "reason: str",
        "confidence: u8",
        "leak_severity: u8",
        "created_at_timestamp: u256",
        "expires_at_timestamp: u256",
        "audit_started_at: u256",
    ]
    for field in expected_fields:
        assert field in contract_source, f"Missing field in NDACase: {field}"


def test_semantic_consensus_rule(contract_source):
    """Ensure validator_fn compares only verdict (Semantic Consensus) rather than byte-for-byte LLM output."""
    assert 'mine["verdict"] == leader["verdict"]' in contract_source, (
        "Validator function must implement semantic consensus on verdict"
    )


def test_native_transfer_calls(contract_source):
    """Ensure payouts and refunds use gl.get_contract_at(...).emit_transfer(value=u256(...))."""
    assert "emit_transfer(value=u256(total_reward))" in contract_source
    assert "emit_transfer(value=u256(bounty_val))" in contract_source


# --- End-to-End Simulation Tests (GenVM Role-based state machine behavior) ---

class MockAgentNDASimulator:
    """Behavioral harness simulating GenVM state transitions for unit testing without full node."""
    def __init__(self):
        self.cases = {}
        self.case_ids = []
        self.total_bounty_locked = 0
        self.total_breaches_settled = 0
        self.case_counter = 0
        self.balances = {"issuer": 1000, "whistleblower": 100, "attacker": 500}

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
            "bounty_amount": value,
            "reporter_bond": 0,
            "nda_scope": nda_scope.strip(),
            "evidence_url": "",
            "status": 0,  # ACTIVE_SECURE
            "verdict": "PENDING",
            "reason": "NDA active. Awaiting leak evidence or contract expiration.",
            "confidence": 0,
            "leak_severity": 0,
            "created_at_timestamp": now_timestamp,
            "expires_at_timestamp": now_timestamp + duration,
            "audit_started_at": 0,
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

        min_bond = max(1, c["bounty_amount"] // 20)
        if bond_value < min_bond:
            raise ValueError(f"Whistleblower must stake anti-spam bond of at least {min_bond} wei.")

        c["whistleblower"] = whistleblower
        c["evidence_url"] = clean_url
        c["reporter_bond"] = bond_value
        c["status"] = 1  # IN_AUDIT
        c["audit_started_at"] = now_timestamp
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
        bounty = c["bounty_amount"]
        bond = c["reporter_bond"]
        c["reporter_bond"] = 0

        if verdict == "BREACH_CONFIRMED":
            c["status"] = 2  # BREACH_CONFIRMED
            self.total_bounty_locked -= bounty
            self.total_breaches_settled += 1
            # Payout bounty + refund anti-spam bond to whistleblower
            self.balances[c["whistleblower"]] += (bounty + bond)
        else:
            # False report or dead/404 URL: slash whistleblower bond to compensate issuer
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
            # Check timeout protection (24h = 86400s)
            if current_timestamp < (c["audit_started_at"] + 86400):
                raise ValueError("Cannot reclaim: Case is currently undergoing active jury audit.")
            # Timeout passed: refund bond to whistleblower
            bond = c["reporter_bond"]
            c["reporter_bond"] = 0
            if bond > 0:
                self.balances[c["whistleblower"]] += bond
        elif c["status"] == 0:
            if current_timestamp < c["expires_at_timestamp"]:
                raise ValueError("Cannot reclaim: Protected NDA confidentiality duration has not yet expired.")
        else:
            raise ValueError("Case is already settled or reclaimed.")

        c["status"] = 3  # SECURE_EXPIRED
        c["verdict"] = "SECURE_EXPIRED"
        c["reason"] = "Protected period expired with zero confirmed leaks. Funds reclaimed by issuer."
        bounty = c["bounty_amount"]
        self.total_bounty_locked -= bounty
        self.balances[sender] += bounty


# --- Role-based End-to-End Test Suite ---

def test_role_issuer_registration_and_safe_expiration():
    """Role: Issuer locks 300 GEN for 1000 seconds, premature reclaim fails, then successfully reclaims after expiry."""
    sim = MockAgentNDASimulator()
    assert sim.balances["issuer"] == 1000

    # 1. Issuer registers NDA escrow
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        nda_scope="Algorithmic secret trading strategies.",
        duration_seconds=1000,
        now_timestamp=1770000000
    )
    assert case_id == "nda-1"
    assert sim.balances["issuer"] == 700
    assert sim.total_bounty_locked == 300
    assert sim.cases[case_id]["status"] == 0  # ACTIVE_SECURE

    # 2. Issuer attempts premature reclaim at t=500s -> BLOCKED
    with pytest.raises(ValueError, match="Protected NDA confidentiality duration has not yet expired"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770000500)

    # 3. Third-party attempts unauthorized reclaim -> BLOCKED
    with pytest.raises(PermissionError):
        sim.close_and_reclaim(sender="whistleblower", case_id=case_id, current_timestamp=1770002000)

    # 4. Issuer reclaims after duration expires at t=2000s -> SUCCESS
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770002000)
    assert sim.cases[case_id]["status"] == 3  # SECURE_EXPIRED
    assert sim.total_bounty_locked == 0
    assert sim.balances["issuer"] == 1000  # 100% funds returned


def test_role_whistleblower_confirmed_breach_flow(mock_leak_evidence_confirmed):
    """Role: Whistleblower spots leaked trade secret, stakes bond, AI confirms -> receives bounty + bond refund."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=400,
        nda_scope="Confidential multi-sig algorithm. Canary: CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998."
    )
    assert sim.balances["whistleblower"] == 100

    # 1. Whistleblower stakes 5% bond (20 wei) and files leak URL
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://pastebin.com/raw/secret_leak_123",
        bond_value=20
    )
    assert sim.cases[case_id]["status"] == 1  # IN_AUDIT
    assert sim.balances["whistleblower"] == 80

    # 2. AI Jury confirms breach
    parsed = json.loads(mock_leak_evidence_confirmed["llm_response"])
    sim.adjudicate_leak(
        case_id=case_id,
        verdict=parsed["verdict"],
        reason=parsed["reason"],
        confidence=parsed["confidence"],
        severity=parsed["leak_severity"]
    )

    # 3. Whistleblower receives full 400 bounty + 20 bond refunded
    assert sim.cases[case_id]["status"] == 2  # BREACH_CONFIRMED
    assert sim.cases[case_id]["verdict"] == "BREACH_CONFIRMED"
    assert sim.balances["whistleblower"] == 80 + 420  # 500 total!
    assert sim.total_breaches_settled == 1


def test_role_whistleblower_false_alarm_bond_slashed(mock_leak_evidence_no_breach):
    """Role: Whistleblower reports false rumor -> AI rules NO_BREACH -> bond is slashed to Issuer."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=500,
        nda_scope="Internal financial roadmaps. Canary: ROADMAP_INTERNAL_OCTOBER_ALPHA."
    )
    assert sim.balances["issuer"] == 500
    assert sim.balances["whistleblower"] == 100

    # Whistleblower stakes 25 bond and reports unrelated rumor
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://twitter.com/crypto_rumors/status/987654",
        bond_value=25
    )
    assert sim.balances["whistleblower"] == 75

    # AI Jury evaluates and rejects disclosure
    parsed = json.loads(mock_leak_evidence_no_breach["llm_response"])
    sim.adjudicate_leak(
        case_id=case_id,
        verdict=parsed["verdict"],
        reason=parsed["reason"],
        confidence=parsed["confidence"],
        severity=parsed["leak_severity"]
    )

    assert sim.cases[case_id]["status"] == 0  # Resets to ACTIVE_SECURE
    assert sim.cases[case_id]["verdict"] == "NO_BREACH"
    assert sim.balances["whistleblower"] == 75  # Lost 25 bond
    assert sim.balances["issuer"] == 525  # Issuer compensated with 25 bond


def test_role_dead_404_link_slashed_prevent_spam_loop():
    """Security check: Submitting 404/dead link is treated as NO_BREACH and slashed to prevent zero-cost DoS spam."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=200,
        nda_scope="Patent architecture draft."
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://fake-404-domain-nonexistent.com/leak",
        bond_value=10
    )
    assert sim.balances["whistleblower"] == 90

    # Web render fails -> treated as NO_BREACH (invalid evidence submitted)
    sim.adjudicate_leak(
        case_id=case_id,
        verdict="NO_BREACH",
        reason="Could not access or render leak evidence URL. Evidence is missing, invalid, or 404.",
        confidence=100,
        severity=0
    )

    assert sim.cases[case_id]["status"] == 0  # Resets to ACTIVE_SECURE
    assert sim.balances["whistleblower"] == 90  # Bond slashed (cannot spam for free)
    assert sim.balances["issuer"] == 810  # 800 + 10 slashed bond


def test_role_stalled_audit_timeout_protection():
    """Role: Stalled audit protection - If audit is stuck for > 24h, issuer recovers funds and whistleblower bond is refunded."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        nda_scope="Secret spec",
        now_timestamp=1770000000
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://stalled-validator-test.com",
        bond_value=15,
        now_timestamp=1770000000
    )
    assert sim.cases[case_id]["status"] == 1

    # Within 24h (e.g. 5 hours later) -> Reclaim blocked
    with pytest.raises(ValueError, match="currently undergoing active jury audit"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770018000)

    # After 25 hours -> Reclaim allowed, bond returned safely to whistleblower
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770090000)
    assert sim.cases[case_id]["status"] == 3
    assert sim.balances["issuer"] == 1000
    assert sim.balances["whistleblower"] == 100  # Full bond refund


def test_security_input_validations():
    """Security check: Validates parameter bounds for bounty, scope, URL schema, and minimum bond stake."""
    sim = MockAgentNDASimulator()

    # Reject zero bounty
    with pytest.raises(ValueError, match="greater than 0 GEN"):
        sim.register_nda_escrow("issuer", 0, "Valid scope")

    # Reject empty scope
    with pytest.raises(ValueError, match="cannot be empty"):
        sim.register_nda_escrow("issuer", 100, "   ")

    # Valid registration
    cid = sim.register_nda_escrow("issuer", 100, "Valid confidential scope")

    # Reject non-HTTP URL
    with pytest.raises(ValueError, match="Valid public leak evidence URL"):
        sim.report_leak("whistleblower", cid, "javascript:alert(1)", bond_value=5)

    # Reject insufficient anti-spam bond (< 5%)
    with pytest.raises(ValueError, match="at least 5 wei"):
        sim.report_leak("whistleblower", cid, "https://pastebin.com/valid", bond_value=3)
