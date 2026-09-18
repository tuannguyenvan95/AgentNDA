import pytest
import json
from pathlib import Path

# Paths
CONTRACTS_DIR = Path(__file__).parent.parent / "contracts"
CONTRACT_PATH = CONTRACTS_DIR / "contract.py"


@pytest.fixture(scope="session")
def contract_source() -> str:
    """Load the AgentNDA intelligent contract source code."""
    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        return f.read()


@pytest.fixture
def mock_leak_evidence_confirmed():
    """Mock web render and LLM verdict response for confirmed confidential leak."""
    return {
        "web_content": "EXCLUSIVE LEAK: We obtained internal confidential logs from Project Alpha. Canary: CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998. The private repo contains code for unreleased multi-sig routing.",
        "llm_response": json.dumps({
            "verdict": "BREACH_CONFIRMED",
            "confidence": 95,
            "leak_severity": 90,
            "reason": "The submitted web evidence reveals the precise canary string CANARY_PHRASE_PROJECT_OMEGA_SEC_KEY_998 and proprietary unreleased multi-sig architecture as specified in protected NDA scope."
        })
    }


@pytest.fixture
def mock_leak_evidence_no_breach():
    """Mock web render and LLM verdict response for false alarm / unrelated public discussion."""
    return {
        "web_content": "Community Speculation: Some users on Twitter are wondering if the DAO will release a new product next quarter. No official announcements or leaks observed.",
        "llm_response": json.dumps({
            "verdict": "NO_BREACH",
            "confidence": 98,
            "leak_severity": 10,
            "reason": "The public evidence contains only general community speculation and does not disclose any confidential trade secrets, code, or canary tokens."
        })
    }
