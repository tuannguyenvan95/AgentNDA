import hashlib
import json
from pathlib import Path
import pytest

CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"
CONTRACT_PATH = CONTRACTS_DIR / "contract.py"


def test_full_genvm_lifecycle_and_security(
    direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie, direct_owner
):
    """
    Executes full on-chain lifecycle in real GenVM:
    1. Register NDA escrow with SHA-256 canary commitment
    2. Attempt fake leak -> Reverted
    3. Submit authentic report with matching canary and bond
    4. Adjudicate breach with snapshot pinning and enhanced validator equivalence
    5. Disburse bounty + bond payout to whistleblower
    """
    issuer = direct_alice
    nda_party = direct_bob
    whistleblower = direct_charlie
    attacker = direct_owner

    direct_vm.sender = issuer
    direct_vm.value = 1000000000000000000  # 1 GEN
    contract = direct_deploy(str(CONTRACT_PATH))

    import sys
    Address = sys.modules["genlayer"].Address

    secret_canary = "CANARY_CONFIDENTIAL_ALPHA_X9"
    canary_hash = hashlib.sha256(secret_canary.encode("utf-8")).hexdigest()

    # Step 1: Register NDA Escrow
    case_id = contract.register_nda_escrow(
        "Proprietary Autonomous Model Weights",
        Address(nda_party),
        "alpha-research-labs",
        canary_hash,
        1000
    )

    case_data = json.loads(contract.get_case(case_id))
    assert case_data["discovered_canary"] == ""
    assert case_data["status"] == 0

    # Step 2: Attacker tries manufactured canary -> Reverts on-chain
    direct_vm.sender = attacker
    direct_vm.value = 50000000000000000
    with pytest.raises(Exception, match="Canary token does not match"):
        contract.report_leak(
            case_id, "https://fake-site.com/leak", "WRONG_TOKEN_GUESS"
        )

    # Step 3: Whistleblower submits valid canary discovery with required bond
    direct_vm.sender = whistleblower
    direct_vm.value = 50000000000000000
    contract.report_leak(
        case_id, "https://archive.org/leak-alpha-weights", secret_canary
    )

    case_in_audit = json.loads(contract.get_case(case_id))
    assert case_in_audit["status"] == 1  # IN_AUDIT
    assert case_in_audit["discovered_canary"] == "[PROTECTED_PROOF]"

    # Step 4: Mock AI Jury Adjudication
    rendered_leak_text = f"Leaked Alpha Model Weights from alpha-research-labs. Confidential token: {secret_canary}"
    direct_vm.mock_web(".*", {"body": rendered_leak_text})
    direct_vm.mock_llm(".*", json.dumps({
        "verdict": "BREACH_CONFIRMED",
        "confidence": 95,
        "leak_severity": 85,
        "canary_found": True,
        "party_attributed": True,
        "reason": "Authentic leak with verified canary exposure attributed to alpha-research-labs."
    }))

    direct_vm.sender = issuer
    direct_vm.value = 0
    contract.adjudicate_leak(case_id)

    # Step 5: Verify Final Payout and Provenance Snapshot Pinning
    final_case = json.loads(contract.get_case(case_id))
    assert final_case["status"] == 2  # BREACH_CONFIRMED
    assert final_case["verdict"] == "BREACH_CONFIRMED"
    assert final_case["discovered_canary"] == secret_canary
    assert len(final_case["evidence_hash"]) == 64
