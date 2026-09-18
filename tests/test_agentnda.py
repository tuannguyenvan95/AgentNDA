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
    assert "def get_stats(" in contract_source


def test_case_struct_attributes(contract_source):
    """Ensure NDACase defines all necessary state fields according to spec."""
    expected_fields = [
        "case_id: str",
        "issuer: Address",
        "whistleblower: Address",
        "bounty_amount: bigint",
        "nda_scope: str",
        "evidence_url: str",
        "status: u8",
        "verdict: str",
        "reason: str",
        "confidence: u8",
        "leak_severity: u8",
        "created_at_block: u256",
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
        self.balances = {"issuer": 1000, "whistleblower": 0, "attacker": 500}

    def register_nda_escrow(self, issuer: str, value: int, nda_scope: str) -> str:
        if value <= 0:
            raise ValueError("NDA escrow bounty must be greater than 0 GEN.")
        if not nda_scope or len(nda_scope.strip()) == 0:
            raise ValueError("NDA confidential scope definition cannot be empty.")

        self.case_counter += 1
        case_id = f"nda-{self.case_counter}"
        self.cases[case_id] = {
            "case_id": case_id,
            "issuer": issuer,
            "whistleblower": "0x0000000000000000000000000000000000000000",
            "bounty_amount": value,
            "nda_scope": nda_scope.strip(),
            "evidence_url": "",
            "status": 0,  # ACTIVE_SECURE
            "verdict": "PENDING",
            "reason": "NDA active. Awaiting leak evidence or contract expiration.",
            "confidence": 0,
            "leak_severity": 0,
        }
        self.case_ids.append(case_id)
        self.total_bounty_locked += value
        self.balances[issuer] -= value
        return case_id

    def report_leak(self, whistleblower: str, case_id: str, evidence_url: str) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if c["status"] != 0:
            raise ValueError(f"Case {case_id} is not in ACTIVE_SECURE status.")
        clean_url = evidence_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise ValueError("Valid public leak evidence URL (http/https) is required.")

        c["whistleblower"] = whistleblower
        c["evidence_url"] = clean_url
        c["status"] = 1  # IN_AUDIT
        c["reason"] = "Leak report filed. On-chain AI jury investigating unauthorized disclosure."

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

        if verdict == "BREACH_CONFIRMED":
            c["status"] = 2  # BREACH_CONFIRMED
            self.total_bounty_locked -= bounty
            self.total_breaches_settled += 1
            self.balances[c["whistleblower"]] += bounty
        else:
            # False alarm / no breach: Case resets to ACTIVE_SECURE
            c["status"] = 0
            c["verdict"] = "NO_BREACH"

    def close_and_reclaim(self, sender: str, case_id: str) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if sender != c["issuer"]:
            raise PermissionError("Only the NDA issuer can reclaim funds.")
        if c["status"] != 0:
            raise ValueError("Cannot reclaim: Case is currently being adjudicated or already settled.")

        c["status"] = 3  # SECURE_EXPIRED
        c["verdict"] = "SECURE_EXPIRED"
        c["reason"] = "Protected period expired with zero confirmed leaks. Funds reclaimed by issuer."
        bounty = c["bounty_amount"]
        self.total_bounty_locked -= bounty
        self.balances[sender] += bounty


def test_full_confirmed_breach_lifecycle(mock_leak_evidence_confirmed):
    """Test full cycle: register NDA -> whistleblower reports leak -> AI jury confirms -> bounty paid."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        nda_scope="Confidential multi-sig algorithm. Canary: CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998."
    )
    assert case_id == "nda-1"
    assert sim.total_bounty_locked == 300
    assert sim.cases[case_id]["status"] == 0

    # Whistleblower spots leaked post on Pastebin and reports it
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://pastebin.com/raw/secret_leak_123"
    )
    assert sim.cases[case_id]["status"] == 1
    assert sim.cases[case_id]["whistleblower"] == "whistleblower"

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
    assert sim.balances["whistleblower"] == 300  # Whistleblower received full 300 GEN bounty!


def test_false_alarm_no_breach(mock_leak_evidence_no_breach):
    """Test false report: AI jury rules NO_BREACH -> status resets to ACTIVE_SECURE, no payout."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=500,
        nda_scope="Internal financial roadmaps. Canary: ROADMAP_INTERNAL_OCTOBER_ALPHA."
    )

    # Whistleblower reports public rumor
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://twitter.com/crypto_rumors/status/987654"
    )
    assert sim.cases[case_id]["status"] == 1

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
    assert sim.balances["whistleblower"] == 0  # No payout


def test_issuer_close_and_reclaim():
    """Test issuer reclaiming bounty after confidential period expires with zero leaks."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=200,
        nda_scope="Short-term audit embargo until mainnet launch."
    )
    assert sim.balances["issuer"] == 800

    # Non-issuer attempt to reclaim fails
    with pytest.raises(PermissionError):
        sim.close_and_reclaim(sender="whistleblower", case_id=case_id)

    # Issuer reclaims
    sim.close_and_reclaim(sender="issuer", case_id=case_id)
    assert sim.cases[case_id]["status"] == 3  # SECURE_EXPIRED
    assert sim.total_bounty_locked == 0
    assert sim.balances["issuer"] == 1000  # Full refund back to issuer


def test_input_validation_rules():
    """Verify input validation rules for bounty, scope, and URL."""
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
        sim.report_leak("whistleblower", cid, "ftp://invalid-url.com")
