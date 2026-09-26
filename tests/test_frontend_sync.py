import pytest
import json
import hashlib
from pathlib import Path

SECRET_CANARY = "SECRET_CANARY_QUANTUM_WEIGHTS_XYZ_987654"
CANARY_COMMITMENT = hashlib.sha256(SECRET_CANARY.encode("utf-8")).hexdigest().lower()


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
            "bounty_amount": str(value),
            "reporter_bond": "0",
            "public_nda_topic": public_nda_topic.strip(),
            "canary_commitment": clean_commitment,
            "discovered_canary": "",
            "evidence_url": "",
            "status": 0,  # ACTIVE_SECURE
            "verdict": "PENDING",
            "reason": "NDA active. Bound party registered with non-public cryptographic canary commitment.",
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

        min_bond = max(1, int(c["bounty_amount"]) // 20)
        if bond_value < min_bond:
            raise ValueError(f"Whistleblower must stake anti-spam bond of at least {min_bond} wei.")

        c["whistleblower"] = whistleblower
        c["evidence_url"] = clean_url
        c["discovered_canary"] = clean_canary
        c["reporter_bond"] = str(bond_value)
        c["status"] = 1  # IN_AUDIT
        c["audit_started_at"] = str(now_timestamp)
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
    """Task 1: Issuer registers docket with non-public commitment, locks bounty, and JSON matches NDACaseData."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Proprietary AI Weight Compression Algorithm v4",
        nda_party="0xVendorParty",
        party_identifier="github.com/vendor-ai",
        canary_commitment=CANARY_COMMITMENT,
        duration_seconds=2592000,
        now_timestamp=1770000000
    )

    raw_case = node.get_case(cid)
    data = json.loads(raw_case)

    # Required fields matching frontend interface NDACaseData
    required_keys = [
        "case_id", "issuer", "nda_party", "party_identifier",
        "whistleblower", "bounty_amount", "reporter_bond",
        "public_nda_topic", "canary_commitment", "discovered_canary",
        "evidence_url", "status", "verdict", "reason", "confidence",
        "leak_severity", "created_at_timestamp", "expires_at_timestamp"
    ]
    for k in required_keys:
        assert k in data, f"Missing key {k} in NDACaseData schema"

    assert data["case_id"] == "nda-1"
    assert data["issuer"] == "0xIssuer1"
    assert data["nda_party"] == "0xVendorParty"
    assert data["party_identifier"] == "github.com/vendor-ai"
    assert data["status"] == 0
    assert data["verdict"] == "PENDING"
    assert data["bounty_amount"] == str(bounty_wei)
    assert data["canary_commitment"] == CANARY_COMMITMENT

    stats = json.loads(node.get_stats())
    assert stats["total_cases"] == 1
    assert stats["total_bounty_locked"] == str(bounty_wei)


def test_task_2_whistleblower_reports_leak_with_proof_of_discovery():
    """Task 2: Whistleblower submits leak URL with discovered canary and 5% bond. Docket transitions to IN_AUDIT."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Proprietary Algorithms",
        nda_party="0xVendorParty",
        party_identifier="github.com/vendor-ai",
        canary_commitment=CANARY_COMMITMENT
    )

    bond_wei = int(bounty_wei * 0.05)  # 0.5 GEN
    initial_wb_bal = node.balances["0xWhistleblower1"]

    node.report_leak(
        whistleblower="0xWhistleblower1",
        case_id=cid,
        evidence_url="https://github.com/leaked-repo/leak-mirror-canary-7781",
        discovered_canary=SECRET_CANARY,
        bond_value=bond_wei,
        now_timestamp=1770000100
    )

    assert node.balances["0xWhistleblower1"] == initial_wb_bal - bond_wei

    data = json.loads(node.get_case(cid))
    assert data["status"] == 1
    assert data["whistleblower"] == "0xWhistleblower1"
    assert data["discovered_canary"] == SECRET_CANARY
    assert data["reporter_bond"] == str(bond_wei)


def test_task_3_ai_jury_breach_confirmed_and_payout():
    """Task 3: AI Jury confirms breach with verifiable provenance -> Whistleblower receives bounty + bond refund."""
    node = SimulatedGenLayerNode()
    bounty_wei = 10 * 10**18
    bond_wei = 5 * 10**17  # 0.5 GEN
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Proprietary Algorithms",
        nda_party="0xVendorParty",
        party_identifier="github.com/vendor-ai",
        canary_commitment=CANARY_COMMITMENT
    )
    node.report_leak("0xWhistleblower1", cid, "https://pastebin.com/leak123", SECRET_CANARY, bond_wei)

    wb_bal_before_adjudicate = node.balances["0xWhistleblower1"]

    mock_web = f"LEAK from github.com/vendor-ai: {SECRET_CANARY} with internal weights."
    node.adjudicate_leak(
        case_id=cid,
        web_content=mock_web,
        verdict="BREACH_CONFIRMED",
        reason="Semantic analysis verified unauthorized publication containing exact canary secret tied to vendor.",
        confidence=96,
        severity=92
    )

    assert node.balances["0xWhistleblower1"] == wb_bal_before_adjudicate + bounty_wei + bond_wei

    data = json.loads(node.get_case(cid))
    assert data["status"] == 2
    assert data["verdict"] == "BREACH_CONFIRMED"
    assert data["confidence"] == 96
    assert data["leak_severity"] == 92


def test_task_4_false_canary_rejected_on_chain():
    """Task 4: A reporter attempting to submit a manufactured canary fails on-chain before audit."""
    node = SimulatedGenLayerNode()
    bounty_wei = 5 * 10**18
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Patent formula",
        nda_party="0xPartner",
        party_identifier="partner.io",
        canary_commitment=CANARY_COMMITMENT
    )

    with pytest.raises(ValueError, match="Canary token does not match non-public commitment"):
        node.report_leak(
            whistleblower="0xWhistleblower1",
            case_id=cid,
            evidence_url="https://news.com/unrelated",
            discovered_canary="WRONG_CANARY_NOT_IN_COMMITMENT",
            bond_value=int(bounty_wei * 0.05)
        )


def test_task_5_url_without_canary_slashed_to_issuer():
    """Task 5: Valid canary submitted but webpage does not contain canary -> bond slashed to issuer."""
    node = SimulatedGenLayerNode()
    bounty_wei = 4 * 10**18
    bond_wei = 2 * 10**17
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Secret blueprints",
        nda_party="0xPartner",
        party_identifier="partner.io",
        canary_commitment=CANARY_COMMITMENT
    )
    node.report_leak("0xAttacker", cid, "https://dead-404-site.invalid/leak", SECRET_CANARY, bond_wei)

    issuer_bal_before = node.balances["0xIssuer1"]

    # Web content does not contain canary
    node.adjudicate_leak(
        case_id=cid,
        web_content="404 Not Found - Nothing here",
        verdict="BREACH_CONFIRMED",  # Will be overridden
        reason="",
        confidence=0,
        severity=0
    )

    # Slashed to issuer
    assert node.balances["0xIssuer1"] == issuer_bal_before + bond_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 0
    assert data["verdict"] == "NO_BREACH"


def test_task_6_expiration_and_safe_reclaim():
    """Task 6: Term expires without breach -> Issuer reclaims 100% escrowed bounty."""
    node = SimulatedGenLayerNode()
    bounty_wei = 2 * 10**18
    duration = 7 * 86400
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Temporary NDA",
        nda_party="0xPartner",
        party_identifier="partner.io",
        canary_commitment=CANARY_COMMITMENT,
        duration_seconds=duration,
        now_timestamp=1770000000
    )

    with pytest.raises(ValueError, match="confidentiality duration has not yet expired"):
        node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 86400)

    issuer_bal_before = node.balances["0xIssuer1"]
    node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + duration + 10)

    assert node.balances["0xIssuer1"] == issuer_bal_before + bounty_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 3


def test_task_7_stalled_audit_timeout_protection():
    """Task 7: Audit stalled for >24 hours allows reclaim with bond refunded to whistleblower."""
    node = SimulatedGenLayerNode()
    bounty_wei = 3 * 10**18
    bond_wei = 15 * 10**16
    cid = node.register_nda_escrow(
        issuer="0xIssuer1",
        value=bounty_wei,
        public_nda_topic="Stalled audit case",
        nda_party="0xPartner",
        party_identifier="partner.io",
        canary_commitment=CANARY_COMMITMENT,
        now_timestamp=1770000000
    )
    node.report_leak("0xWhistleblower1", cid, "https://stalled-test.org", SECRET_CANARY, bond_wei, now_timestamp=1770000000)

    with pytest.raises(ValueError, match="24h protection"):
        node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 40000)

    wb_bal_before = node.balances["0xWhistleblower1"]
    issuer_bal_before = node.balances["0xIssuer1"]

    node.close_and_reclaim("0xIssuer1", cid, current_timestamp=1770000000 + 90000)

    assert node.balances["0xWhistleblower1"] == wb_bal_before + bond_wei
    assert node.balances["0xIssuer1"] == issuer_bal_before + bounty_wei
    data = json.loads(node.get_case(cid))
    assert data["status"] == 3


def test_task_8_pagination_and_all_cases_sync():
    """Task 8: Verify get_all_cases and get_cases_paginated match frontend consumption."""
    node = SimulatedGenLayerNode()
    cids = []
    for i in range(5):
        cids.append(node.register_nda_escrow(
            "0xIssuer1",
            (i + 1) * 10**18,
            f"Topic {i+1}",
            "0xPartner",
            "partner.io",
            CANARY_COMMITMENT
        ))

    all_cases = json.loads(node.get_all_cases())
    assert len(all_cases) == 5
    assert [c["case_id"] for c in all_cases] == cids

    page1 = json.loads(node.get_cases_paginated(0, 2))
    assert len(page1) == 2
    assert page1[0]["case_id"] == "nda-1"
