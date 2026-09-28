import pytest
import hashlib
import json
from pathlib import Path

CONTRACT_PATH = Path(__file__).parent.parent / "contracts" / "contract.py"


def test_real_genvm_full_flow_with_storage_compatibility(
    direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie
):
    """
    Real GenVM Execution Test:
    Verifies that NDACase with u64 case_id and native storage types executes without .as_bytes crash.
    Validates:
    1. Register NDA Escrow with non-public commitment and bound counterparty.
    2. Canary privacy: discovered_canary remains masked in public view calls.
    3. Rejection of manufactured leak (wrong canary token).
    4. Successful report with verified canary and anti-spam bond.
    5. Pagination and statistics.
    """
    issuer = direct_alice
    bound_party = direct_bob
    whistleblower = direct_charlie

    secret_canary = "CANARY_CONFIDENTIAL_TOKEN_DELTA_77"
    canary_hash = hashlib.sha256(secret_canary.encode("utf-8")).hexdigest()

    # 1. Deploy contract on real GenVM
    direct_vm.sender = issuer
    direct_vm.value = 2000000000000000000  # 2 GEN
    contract = direct_deploy(str(CONTRACT_PATH))

    import sys
    Address = sys.modules["genlayer"].Address

    # 2. Register NDA Escrow -> Returns numeric u64 case_id
    case_id = contract.register_nda_escrow(
        "Project Delta Quantum Architecture",
        Address(bound_party),
        "delta-quantum-labs",
        canary_hash,
        86400  # 1 day
    )

    assert int(case_id) == 1, "First case ID must be 1"

    # Verify case state via get_case
    c_raw = contract.get_case(case_id)
    c_data = json.loads(c_raw)
    assert c_data["case_id"] == 1
    assert c_data["status"] == 0  # ACTIVE_SECURE
    assert c_data["party_identifier"] == "delta-quantum-labs"
    assert c_data["canary_commitment"] == canary_hash.lower()
    # Privacy check: discovered_canary must NOT be exposed
    assert c_data["discovered_canary"] == ""

    # Verify count and get_case_id_by_index
    assert contract.get_case_count() == 1
    assert contract.get_case_id_by_index(0) == case_id

    # 3. Attacker attempts to report leak with fake canary -> MUST REVERT
    direct_vm.sender = direct_alice
    direct_vm.value = 100000000000000000  # 0.1 GEN
    with pytest.raises(Exception, match="Canary token does not match the non-public commitment"):
        contract.report_leak(
            case_id,
            "https://fake-leak-site.com/post",
            "FAKE_MANUFACTURED_TOKEN_999"
        )

    # 4. Legitimate Whistleblower reports leak with verified proof-of-discovery
    direct_vm.sender = whistleblower
    direct_vm.value = 100000000000000000  # 0.1 GEN bond (5% of 2 GEN)
    contract.report_leak(
        case_id,
        "https://archive.org/leak-delta-quantum",
        secret_canary
    )

    # 5. Verify status IN_AUDIT and canary privacy masking
    c_audit_raw = contract.get_case(case_id)
    c_audit = json.loads(c_audit_raw)
    assert c_audit["status"] == 1  # IN_AUDIT
    # Crucial security check: discovered_canary MUST be masked during audit to prevent front-running
    assert c_audit["discovered_canary"] == "[PROTECTED_PROOF]"

    # Verify paginated view also protects privacy
    paginated_raw = contract.get_cases_paginated(0, 10)
    paginated_list = json.loads(paginated_raw)
    assert len(paginated_list) == 1
    assert paginated_list[0]["discovered_canary"] == "[PROTECTED_PROOF]"

    # Verify stats
    stats_raw = contract.get_stats()
    stats = json.loads(stats_raw)
    assert stats["total_cases"] == 1
