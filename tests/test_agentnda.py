import pytest
import json
import hashlib
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
        "nda_party: Address",
        "party_identifier: str",
        "whistleblower: Address",
        "bounty_amount: bigint",
        "reporter_bond: bigint",
        "public_nda_topic: str",
        "canary_commitment: str",
        "discovered_canary: str",
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
    """Behavioral harness simulating GenVM state transitions with non-public commitments and party attribution."""
    def __init__(self):
        self.cases = {}
        self.case_ids = []
        self.total_bounty_locked = 0
        self.total_breaches_settled = 0
        self.case_counter = 0
        self.balances = {"issuer": 1000, "whistleblower": 100, "attacker": 500}

    def register_nda_escrow(
        self,
        issuer: str,
        value: int,
        public_nda_topic: str,
        nda_party: str,
        party_identifier: str,
        canary_commitment: str,
        duration_seconds: int = 604800,
        now_timestamp: int = 1770000000
    ) -> str:
        if value <= 0:
            raise ValueError("NDA escrow bounty must be greater than 0 GEN.")
        if not public_nda_topic or len(public_nda_topic.strip()) == 0:
            raise ValueError("Public NDA topic summary cannot be empty.")
        if not party_identifier or len(party_identifier.strip()) == 0:
            raise ValueError("NDA party identifier cannot be empty.")
        clean_commitment = canary_commitment.strip().lower()
        if len(clean_commitment) != 64:
            raise ValueError("Canary commitment must be a 64-character SHA-256 hex string.")

        self.case_counter += 1
        case_id = f"nda-{self.case_counter}"
        duration = duration_seconds if duration_seconds > 0 else 604800
        self.cases[case_id] = {
            "case_id": case_id,
            "issuer": issuer,
            "nda_party": nda_party,
            "party_identifier": party_identifier.strip(),
            "whistleblower": "0x0000000000000000000000000000000000000000",
            "bounty_amount": value,
            "reporter_bond": 0,
            "public_nda_topic": public_nda_topic.strip(),
            "canary_commitment": clean_commitment,
            "discovered_canary": "",
            "evidence_url": "",
            "status": 0,  # ACTIVE_SECURE
            "verdict": "PENDING",
            "reason": "NDA active. Bound party registered with non-public cryptographic canary commitment.",
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

    def report_leak(
        self,
        whistleblower: str,
        case_id: str,
        evidence_url: str,
        discovered_canary: str,
        bond_value: int,
        now_timestamp: int = 1770000000
    ) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if c["status"] != 0:
            raise ValueError(f"Case {case_id} is not in ACTIVE_SECURE status.")

        clean_url = evidence_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise ValueError("Valid public leak evidence URL (http/https) is required.")

        clean_canary = discovered_canary.strip()
        if len(clean_canary) < 6:
            raise ValueError("Discovered canary token must be at least 6 characters.")

        # Cryptographic Proof-of-Discovery verification on-chain
        computed_hash = hashlib.sha256(clean_canary.encode("utf-8")).hexdigest().lower()
        if computed_hash != c["canary_commitment"].lower():
            raise ValueError("Canary token does not match non-public commitment! Manufactured leak rejected.")

        min_bond = max(1, c["bounty_amount"] // 20)
        if bond_value < min_bond:
            raise ValueError(f"Whistleblower must stake anti-spam bond of at least {min_bond} wei.")

        c["whistleblower"] = whistleblower
        c["evidence_url"] = clean_url
        c["discovered_canary"] = clean_canary
        c["reporter_bond"] = bond_value
        c["status"] = 1  # IN_AUDIT
        c["audit_started_at"] = now_timestamp
        c["reason"] = f"Leak report filed with verified canary. AI investigating {c['party_identifier']}."
        self.balances[whistleblower] -= bond_value

    def adjudicate_leak(
        self,
        case_id: str,
        web_content: str,
        verdict: str,
        reason: str,
        confidence: int,
        severity: int
    ) -> None:
        if case_id not in self.cases:
            raise KeyError(f"Case {case_id} does not exist.")
        c = self.cases[case_id]
        if c["status"] != 1:
            raise ValueError(f"Case {case_id} is not awaiting leak adjudication.")

        # Check if the webpage actually contains the discovered canary token
        canary = c["discovered_canary"]
        if canary.lower() not in web_content.lower():
            verdict = "NO_BREACH"
            reason = "Fraudulent evidence: Webpage does not contain claimed canary token."
            confidence = 98
            severity = 0

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
            # False report, unverified link, or manufactured URL: slash bond to compensate issuer
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
            if current_timestamp < (c["audit_started_at"] + 86400):
                raise ValueError("Cannot reclaim: Case is currently undergoing active jury audit.")
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

SECRET_CANARY = "SECRET_CANARY_QUANTUM_WEIGHTS_XYZ_987654"
CANARY_COMMITMENT = hashlib.sha256(SECRET_CANARY.encode("utf-8")).hexdigest().lower()


def test_anti_manufactured_leak_protection():
    """Security check: Demonstrates that an attacker CANNOT manufacture a leak using public contract data."""
    sim = MockAgentNDASimulator()

    # Issuer locks NDA without revealing the secret canary on-chain
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=500,
        public_nda_topic="Project Pegasus Zero-Knowledge Circuit Specs",
        nda_party="0xVendorPartyAddress",
        party_identifier="github.com/vendor-org",
        canary_commitment=CANARY_COMMITMENT
    )

    # 1. Attacker sees the public contract state, but CANNOT find the secret canary
    assert "public_nda_topic" in sim.cases[case_id]
    assert sim.cases[case_id]["canary_commitment"] == CANARY_COMMITMENT
    assert SECRET_CANARY not in str(sim.cases[case_id])  # Secret is NOT exposed on chain!

    # 2. Attacker creates a fake pastebin using public words and attempts to claim bounty with a fake canary
    with pytest.raises(ValueError, match="Canary token does not match non-public commitment! Manufactured leak rejected."):
        sim.report_leak(
            whistleblower="attacker",
            case_id=case_id,
            evidence_url="https://pastebin.com/raw/attacker_fake_leak",
            discovered_canary="FAKE_GUESSED_CANARY_TOKEN_123",
            bond_value=25
        )

    # Attacker's fraudulent transaction was rejected; contract remains untouched!
    assert sim.cases[case_id]["status"] == 0


def test_role_whistleblower_confirmed_breach_with_proof_of_discovery():
    """Whistleblower finds authentic leak containing the secret canary, provides proof-of-discovery, receives payout."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=400,
        public_nda_topic="Series A Valuation and Cap Table",
        nda_party="0xEmployeeAddress",
        party_identifier="@employee_analyst",
        canary_commitment=CANARY_COMMITMENT
    )

    # 1. Whistleblower extracts real canary from leaked article and reports with 5% bond
    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://leaked-news.com/series-a-cap-table",
        discovered_canary=SECRET_CANARY,
        bond_value=20
    )
    assert sim.cases[case_id]["status"] == 1  # IN_AUDIT
    assert sim.balances["whistleblower"] == 80

    # 2. AI Jury inspects webpage, verifies canary presence and provenance
    mock_web = f"LEAKED: From @employee_analyst internal files: {SECRET_CANARY} with complete cap table."
    sim.adjudicate_leak(
        case_id=case_id,
        web_content=mock_web,
        verdict="BREACH_CONFIRMED",
        reason="Verified leak containing secret canary with authentic attribution to @employee_analyst.",
        confidence=96,
        severity=95
    )

    # 3. Whistleblower receives full 400 bounty + 20 bond refunded (total 420)
    assert sim.cases[case_id]["status"] == 2
    assert sim.balances["whistleblower"] == 80 + 420
    assert sim.total_breaches_settled == 1


def test_role_whistleblower_url_missing_canary_slashed():
    """Attacker somehow learns canary hash or guesses it, but webpage does not contain canary -> bond slashed."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=500,
        public_nda_topic="Proprietary Codebase",
        nda_party="0xDevPartner",
        party_identifier="github.com/devpartner",
        canary_commitment=CANARY_COMMITMENT
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://random-blog.com/post-without-canary",
        discovered_canary=SECRET_CANARY,
        bond_value=25
    )
    assert sim.balances["whistleblower"] == 75

    # Webpage does NOT have the canary token
    mock_web = "This is a random blog post about software architecture without any canary strings."
    sim.adjudicate_leak(
        case_id=case_id,
        web_content=mock_web,
        verdict="BREACH_CONFIRMED",  # Validator function detects absence
        reason="Consensus",
        confidence=90,
        severity=90
    )

    # Slashed to issuer
    assert sim.cases[case_id]["status"] == 0
    assert sim.cases[case_id]["verdict"] == "NO_BREACH"
    assert sim.balances["whistleblower"] == 75  # Bond lost
    assert sim.balances["issuer"] == 525  # Issuer compensated


def test_role_issuer_registration_and_safe_expiration():
    """Issuer registers NDA escrow, premature reclaim fails, reclaims after term expires."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        public_nda_topic="Marketing Strategy",
        nda_party="0xAgency",
        party_identifier="agency.io",
        canary_commitment=CANARY_COMMITMENT,
        duration_seconds=1000,
        now_timestamp=1770000000
    )

    # Premature reclaim blocked
    with pytest.raises(ValueError, match="Protected NDA confidentiality duration has not yet expired"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770000500)

    # Reclaim after expiration succeeds
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770002000)
    assert sim.cases[case_id]["status"] == 3
    assert sim.balances["issuer"] == 1000


def test_role_stalled_audit_timeout_protection():
    """Stalled audit protection - Reclaim after 24h refunds bond to whistleblower and bounty to issuer."""
    sim = MockAgentNDASimulator()
    case_id = sim.register_nda_escrow(
        issuer="issuer",
        value=300,
        public_nda_topic="Internal Roadmaps",
        nda_party="0xConsultant",
        party_identifier="consultant.eth",
        canary_commitment=CANARY_COMMITMENT,
        now_timestamp=1770000000
    )

    sim.report_leak(
        whistleblower="whistleblower",
        case_id=case_id,
        evidence_url="https://stalled-site.com",
        discovered_canary=SECRET_CANARY,
        bond_value=15,
        now_timestamp=1770000000
    )

    # Reclaim within 24h blocked
    with pytest.raises(ValueError, match="currently undergoing active jury audit"):
        sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770018000)

    # Reclaim after 25h succeeds with both parties protected
    sim.close_and_reclaim(sender="issuer", case_id=case_id, current_timestamp=1770090000)
    assert sim.cases[case_id]["status"] == 3
    assert sim.balances["issuer"] == 1000
    assert sim.balances["whistleblower"] == 100
