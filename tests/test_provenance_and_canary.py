import pytest
import hashlib
import json
from pathlib import Path

CONTRACT_PATH = Path(__file__).parent.parent / "contracts" / "contract.py"


def test_cannot_report_without_matching_secret_canary_standalone():
    """
    Standalone proof: An attacker CANNOT report a leak without knowing the secret canary.
    Manufactured leaks with guessed/fake tokens are cryptographically rejected on-chain.
    """
    secret_canary = "CANARY_CONFIDENTIAL_SECRET_TOKEN_99"
    canary_hash = hashlib.sha256(secret_canary.encode("utf-8")).hexdigest()

    # Verify that fake guess produces a mismatch
    attacker_guess = "FAKE_GUESS_TOKEN_1234"
    attacker_hash = hashlib.sha256(attacker_guess.encode("utf-8")).hexdigest()

    assert attacker_hash != canary_hash, "Guessed token must not collide with commitment hash"

    def verify_report(commitment: str, discovered_canary: str):
        clean_canary = discovered_canary.strip()
        computed = hashlib.sha256(clean_canary.encode("utf-8")).hexdigest().lower()
        if computed != commitment.lower():
            raise ValueError("Canary token does not match the non-public commitment! Manufactured leak rejected.")
        return True

    # 1. Attacker attempt fails
    with pytest.raises(ValueError, match="Canary token does not match the non-public commitment"):
        verify_report(canary_hash, attacker_guess)

    # 2. Legitimate whistleblower succeeds
    assert verify_report(canary_hash, secret_canary) is True


def test_cannot_report_without_matching_secret_canary_genvm(
    direct_deploy, direct_vm, direct_alice, direct_bob, direct_charlie
):
    """
    GenVM direct execution test:
    Verifies that calling report_leak on an active contract reverts if the canary does not match the commitment.
    """
    issuer = direct_alice
    bound_party = direct_bob
    attacker = direct_charlie

    # Secret canary known only to issuer and bound party
    secret_canary = "CANARY_CONFIDENTIAL_SECRET_TOKEN_99"
    canary_hash = hashlib.sha256(secret_canary.encode("utf-8")).hexdigest()

    # 1. Register NDA escrow with non-public canary commitment
    direct_vm.sender = issuer
    direct_vm.value = 1000000000000000000  # 1 GEN
    contract = direct_deploy(str(CONTRACT_PATH))

    import sys
    Address = sys.modules["genlayer"].Address

    case_id = contract.register_nda_escrow(
        "Project Chimera Core Architecture",
        Address(bound_party),
        "chimera-dev-team",
        canary_hash,
        1000
    )

    # 2. Attacker attempts to manufacture a leak with a random/fake canary token -> MUST REVERT
    direct_vm.sender = attacker
    direct_vm.value = 100000000000000000  # 0.1 GEN bond
    with pytest.raises(Exception, match="Canary token does not match the non-public commitment"):
        contract.report_leak(
            case_id,
            "https://fake-leak-page.com/post",
            "FAKE_GUESS_TOKEN_1234"
        )

    # 3. Legitimate whistleblower with genuine discovered canary passes cryptographic verification
    contract.report_leak(
        case_id,
        "https://archive.org/leak-chimera-repo",
        secret_canary
    )

    c_raw = contract.get_case(case_id)
    c_data = json.loads(c_raw)
    assert c_data["status"] == 1  # IN_AUDIT
