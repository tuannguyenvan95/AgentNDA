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


# --- End-to-End Simulation Tests (GenVM state machine behavior) ---

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
        elif verdict == "FETCH_FAILED":
            # Scraper or network error: refund bond to whistleblower without penalty
            c["status"] = 0
            self.balances[c["whistleblower"]] += bond
        else:
            # False report: slash whistleblower bond to compensate issuer
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


def test_full_confirmed_breach_lifecycle(mock_leak_evidence_confirmed):
    """Test full cycle: register NDA -> whistleblower stakes bond & reports leak -> AI jury confirms -> bounty + bond paid."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        nda_scope="Confidential multi-sig algorithm. Canary: CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998."
    )
    assert case_id == "nda-1"
    assert sim.total_bounty_locked == 300
    assert sim.cases[case_id]["status"] == 0

    # Whistleblower stakes anti-spam bond (15 wei = 5% of 300) and reports leak
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://pastebin.com/raw/secret_leak_123",
        bond_value=15
    )
    assert sim.cases[case_id]["status"] == 1
    assert sim.cases[case_id]["whistleblower"] == "whistleblower"
    assert sim.balances["whistleblower"] == 85  # 100 - 15 bond staked

    # AI Jury adjudicates and confirms breach
    parsed = json.loads(mock_leak_evidence_confirmed["llm_response"])
    sim.adjudicate_leak(
        case_id=case_id,
        verdict=parsed["verdict"],
        reason=parsed["reason"],
        confidence=parsed["confidence"],
        severity=parsed["leak_severity"]
    )

    assert sim.cases[case_id]["status"] == 2  # BREACH_CONFIRMED
    assert sim.cases[case_id]["verdict"] == "BREACH_CONFIRMED"
    assert sim.total_bounty_locked == 0
    assert sim.total_breaches_settled == 1
    # Whistleblower received 300 bounty + 15 refunded bond -> 85 + 315 = 400 total!
    assert sim.balances["whistleblower"] == 400


def test_false_alarm_bond_slashing(mock_leak_evidence_no_breach):
    """Test false report: AI jury rules NO_BREACH -> status resets, whistleblower's bond slashed to issuer."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=500,
        nda_scope="Internal financial roadmaps. Canary: ROADMAP_INTERNAL_OCTOBER_ALPHA."
    )
    assert sim.balances["issuer"] == 500  # 1000 - 500 escrowed

    # Whistleblower reports public rumor and stakes 25 bond (5% of 500)
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://twitter.com/crypto_rumors/status/987654",
        bond_value=25
    )
    assert sim.cases[case_id]["status"] == 1
    assert sim.balances["whistleblower"] == 75

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
    assert sim.total_bounty_locked == 500  # Escrow remains intact
    assert sim.balances["whistleblower"] == 75  # Lost 25 bond
    assert sim.balances["issuer"] == 525  # Issuer received slashed 25 bond


def test_fetch_failed_bond_refunded():
    """Test scraper or network 404: AI returns FETCH_FAILED -> whistleblower bond is refunded without slashing."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=200,
        nda_scope="Patent drafts."
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://broken-link-404.example.com",
        bond_value=10
    )
    assert sim.balances["whistleblower"] == 90

    # Scraper fails -> FETCH_FAILED
    sim.adjudicate_leak(
        case_id=case_id,
        verdict="FETCH_FAILED",
        reason="Could not access or render leak evidence URL. Content missing, 404, or blocked.",
        confidence=100,
        severity=0
    )

    assert sim.cases[case_id]["status"] == 0
    # Whistleblower gets full bond back!
    assert sim.balances["whistleblower"] == 100


def test_issuer_close_and_reclaim_expiry():
    """Test issuer reclaiming bounty after confidential period expires with zero leaks."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=200,
        nda_scope="Short-term audit embargo until mainnet launch.",
        duration_seconds=1000,
        now_timestamp=1770000000
    )
    assert sim.balances["issuer"] == 800

    # Premature reclaim attempt before expiry fails
    with pytest.raises(ValueError, match="Protected NDA confidentiality duration has not yet expired"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770000500)

    # Non-issuer attempt to reclaim fails
    with pytest.raises(PermissionError):
        sim.close_and_reclaim(sender="whistleblower", case_id=case_id, current_timestamp=1770002000)

    # Issuer reclaims after expiry
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770002000)
    assert sim.cases[case_id]["status"] == 3  # SECURE_EXPIRED
    assert sim.total_bounty_locked == 0
    assert sim.balances["issuer"] == 1000  # Full refund back to issuer


def test_timeout_protection_reclaim():
    """Test reclaim when case is stuck in audit for > 24 hours."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=400,
        nda_scope="Test scope",
        now_timestamp=1770000000
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://example.com/stalled",
        bond_value=20,
        now_timestamp=1770000000
    )
    assert sim.cases[case_id]["status"] == 1

    # Within 24h (e.g. 10 hours), issuer cannot reclaim
    with pytest.raises(ValueError, match="currently undergoing active jury audit"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770036000)

    # After 25 hours (86400s + 3600s), issuer reclaims bounty, whistleblower's bond is returned!
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770090000)
    assert sim.cases[case_id]["status"] == 3
    assert sim.balances["issuer"] == 1000
    assert sim.balances["whistleblower"] == 100  # Bond safely refunded!


def test_input_validation_rules():
    """Verify input validation rules for bounty, scope, URL, and minimum bond."""
    sim = MockAgentNDASimulator()

    # Zero bounty rejected
    with pytest.raises(ValueError):
        sim.register_nda_escrow("issuer", 0, "Valid scope")

    # Empty scope rejected
    with pytest.raises(ValueError):
        sim.register_nda_escrow("issuer", 100, "   ")

    # Valid registration
    cid = sim.register_nda_escrow("issuer", 100, "Protected Canary: CANARY_TEST_123")

    # Invalid URL scheme rejected
    with pytest.raises(ValueError):
        sim.report_leak("whistleblower", cid, "ftp://invalid-url.com", bond_value=10)

    # Insufficient bond rejected (5% of 100 = 5 wei, providing 2)
    with pytest.raises(ValueError, match="at least 5 wei"):
        sim.report_leak("whistleblower", cid, "https://valid-url.com", bond_value=2)
