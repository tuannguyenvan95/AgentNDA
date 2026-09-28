# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json
import hashlib


def _addr_str(addr: Address) -> str:
    """Safely format an Address instance into a hex string."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


@allow_storage
@dataclass
class NDACase:
    """
    Storage struct representing an on-chain autonomous NDA and leak escrow.
    Enforces non-public commitments, counterparty attribution, and verifiable provenance.
    Uses u64 numeric identifier for native GenLayer storage compatibility.
    """
    case_id: u64                   # Storage-compatible numeric case ID
    issuer: Address
    nda_party: Address             # Bound NDA counterparty (recipient of confidential assets)
    party_identifier: str          # Public handle, org, or domain tied to counterparty (e.g. github org/handle)
    whistleblower: Address
    bounty_amount: bigint
    reporter_bond: bigint         # Anti-spam deposit staked by whistleblower
    public_nda_topic: str          # Public summary of the NDA topic (NO CONFIDENTIAL SECRETS)
    canary_commitment: str         # Non-public cryptographic commitment: sha256(secret_canary)
    discovered_canary: str         # Secret canary revealed by whistleblower upon finding leak
    evidence_url: str              # Public URL of leaked article, commit, or archive
    evidence_hash: str             # Immutable SHA-256 snapshot of web evidence content
    status: u8                     # 0: ACTIVE_SECURE, 1: IN_AUDIT, 2: BREACH_CONFIRMED, 3: SECURE_EXPIRED
    verdict: str                   # "PENDING", "BREACH_CONFIRMED", "NO_BREACH", "SECURE_EXPIRED"
    reason: str                    # Detailed jury breach justification & provenance verification
    confidence: u8                 # 0 - 100: Validator consensus confidence
    leak_severity: u8              # 0 - 100: Degree of confidential exposure
    created_at_timestamp: u256
    expires_at_timestamp: u256     # Timestamp after which issuer can reclaim funds
    audit_started_at: u256         # Timestamp when report_leak was triggered (for timeout protection)


def _format_case_dict(c: NDACase) -> dict:
    """
    Helper to serialize an NDACase into a JSON-safe dictionary.
    Privacy safeguard: Masks discovered_canary while case is in audit or active
    to prevent front-running and premature disclosure. Only exposes upon confirmed breach.
    """
    exposed_canary = (
        c.discovered_canary
        if c.status == u8(2)
        else ("[PROTECTED_PROOF]" if len(c.discovered_canary) > 0 else "")
    )
    return {
        "case_id": int(c.case_id),
        "issuer": _addr_str(c.issuer),
        "nda_party": _addr_str(c.nda_party),
        "party_identifier": c.party_identifier,
        "whistleblower": _addr_str(c.whistleblower),
        "bounty_amount": str(c.bounty_amount),
        "reporter_bond": str(c.reporter_bond),
        "public_nda_topic": c.public_nda_topic,
        "canary_commitment": c.canary_commitment,
        "discovered_canary": exposed_canary,
        "evidence_url": c.evidence_url,
        "evidence_hash": c.evidence_hash,
        "status": int(c.status),
        "verdict": c.verdict,
        "reason": c.reason,
        "confidence": int(c.confidence),
        "leak_severity": int(c.leak_severity),
        "created_at_timestamp": str(c.created_at_timestamp),
        "expires_at_timestamp": str(c.expires_at_timestamp),
    }


class Contract(gl.Contract):
    """
    AgentNDA: Autonomous Web3 Leak Adjudication and Whistleblower Bounty Escrow
    Target Network: studionet (Chain ID: 61999)
    """
    cases: TreeMap[u64, NDACase]
    case_ids: DynArray[u64]
    total_bounty_locked: bigint
    total_breaches_settled: u32
    case_counter: u64

    def __init__(self):
        # GenVM auto-initializes TreeMap and DynArray. Do NOT reassign in __init__.
        self.total_bounty_locked = bigint(0)
        self.total_breaches_settled = u32(0)
        self.case_counter = u64(0)

    def _get_current_timestamp(self) -> u256:
        """Derive execution timestamp strictly from GenLayer transaction context."""
        try:
            from datetime import datetime
            dt_str = None
            if hasattr(gl, "message") and hasattr(gl.message, "datetime") and gl.message.datetime:
                dt_str = str(gl.message.datetime)
            elif hasattr(gl, "message_raw") and isinstance(gl.message_raw, dict):
                dt_str = str(gl.message_raw.get("datetime", ""))

            if dt_str:
                if dt_str.endswith("Z"):
                    dt_str = dt_str[:-1] + "+00:00"
                dt = datetime.fromisoformat(dt_str)
                ts = int(dt.timestamp())
                if ts > 0:
                    return u256(ts)
        except Exception:
            pass
        return u256(0)

    @gl.public.write.payable
    def register_nda_escrow(
        self,
        public_nda_topic: str,
        nda_party: Address,
        party_identifier: str,
        canary_commitment: str,
        duration_seconds: int,
    ) -> u64:
        """
        Issuer locks native GEN bounty pool, registers bound NDA party and non-public canary commitment.
        Notice: The secret canary token is NEVER published on-chain, preventing reporters from manufacturing leaks.
        """
        bounty = bigint(gl.message.value)
        if bounty <= bigint(0):
            raise ValueError("NDA escrow bounty must be greater than 0 GEN.")

        if not public_nda_topic or len(public_nda_topic.strip()) == 0:
            raise ValueError("Public NDA topic summary cannot be empty.")

        clean_identifier = party_identifier.strip()
        if len(clean_identifier) == 0:
            raise ValueError("NDA party identifier (e.g. GitHub handle, domain, or identity) cannot be empty.")

        clean_commitment = canary_commitment.strip().lower()
        if len(clean_commitment) != 64:
            raise ValueError("Canary commitment must be a valid 64-character SHA-256 hexadecimal hash.")

        duration = u256(duration_seconds if duration_seconds > 0 else 604800)

        self.case_counter = self.case_counter + u64(1)
        case_id = self.case_counter
        now = self._get_current_timestamp()
        expires_at = now + duration
        empty_whistleblower = Address("0x0000000000000000000000000000000000000000")

        new_case = NDACase(
            case_id=case_id,
            issuer=gl.message.sender_address,
            nda_party=nda_party,
            party_identifier=clean_identifier,
            whistleblower=empty_whistleblower,
            bounty_amount=bounty,
            reporter_bond=bigint(0),
            public_nda_topic=public_nda_topic.strip(),
            canary_commitment=clean_commitment,
            discovered_canary="",
            evidence_url="",
            evidence_hash="",
            status=u8(0),  # ACTIVE_SECURE
            verdict="PENDING",
            reason="NDA active. Bound party registered with non-public cryptographic canary commitment.",
            confidence=u8(0),
            leak_severity=u8(0),
            created_at_timestamp=now,
            expires_at_timestamp=expires_at,
            audit_started_at=u256(0),
        )

        self.cases[case_id] = new_case
        self.case_ids.append(case_id)
        self.total_bounty_locked = self.total_bounty_locked + bounty

        return case_id

    @gl.public.write.payable
    def report_leak(self, case_id: u64, evidence_url: str, discovered_canary: str) -> None:
        """
        Whistleblower submits evidence URL and the secret canary token discovered in the leaked document.
        Cryptographic Proof-of-Discovery: On-chain verification verifies discovered_canary against
        canary_commitment. If a reporter attempts to manufacture a fake page, they will fail because
        the secret canary was never published on-chain.
        """
        if case_id not in self.cases:
            raise ValueError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if c.status != u8(0):
            raise ValueError(f"Case {case_id} is not in ACTIVE_SECURE status.")

        clean_url = evidence_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise ValueError("Valid public leak evidence URL (http/https) is required.")

        clean_canary = discovered_canary.strip()
        if len(clean_canary) < 6:
            raise ValueError("Discovered canary token must be at least 6 characters.")

        # Cryptographic Proof-of-Discovery verification on-chain:
        computed_hash = hashlib.sha256(clean_canary.encode("utf-8")).hexdigest().lower()
        if computed_hash != c.canary_commitment.lower():
            raise ValueError(
                "Canary token does not match the non-public commitment! "
                "Manufactured leak or incorrect canary token rejected."
            )

        # Minimum anti-spam bond: 5% of bounty (or at least 1 wei)
        min_bond = c.bounty_amount // bigint(20)
        if min_bond == bigint(0):
            min_bond = bigint(1)

        bond_sent = bigint(gl.message.value)
        if bond_sent < min_bond:
            raise ValueError(f"Whistleblower must stake anti-spam bond of at least {int(min_bond)} wei.")

        c.whistleblower = gl.message.sender_address
        c.evidence_url = clean_url
        c.discovered_canary = clean_canary
        c.reporter_bond = bond_sent
        c.status = u8(1)  # IN_AUDIT
        c.audit_started_at = self._get_current_timestamp()
        c.reason = (
            f"Leak report filed with verified canary discovery. "
            f"AI jury investigating provenance and attribution to bound party {c.party_identifier}."
        )

    @gl.public.write
    def adjudicate_leak(self, case_id: u64) -> None:
        """
        AI Jury fetches evidence URL via gl.nondet.web.render, verifies canary presence in web content,
        evaluates verifiable provenance and attribution to the bound NDA party, and reaches consensus.
        """
        if case_id not in self.cases:
            raise ValueError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if c.status != u8(1):
            raise ValueError(f"Case {case_id} is not awaiting leak adjudication.")

        evidence_url = c.evidence_url
        topic_text = c.public_nda_topic
        party_id = c.party_identifier
        party_addr = _addr_str(c.nda_party)
        canary_text = c.discovered_canary

        def leader_fn():
            raw_evidence = ""
            fetch_error = False
            try:
                raw_evidence = gl.nondet.web.render(evidence_url, mode="text")
            except Exception:
                fetch_error = True

            if fetch_error or not raw_evidence or len(raw_evidence.strip()) == 0:
                return {
                    "verdict": "NO_BREACH",
                    "confidence": 100,
                    "leak_severity": 0,
                    "reason": "Could not access or render leak evidence URL. Evidence is missing, invalid, or 404."
                }

            # Verification: The rendered webpage MUST actually contain the discovered canary!
            if canary_text.lower() not in raw_evidence.lower():
                return {
                    "verdict": "NO_BREACH",
                    "confidence": 98,
                    "leak_severity": 0,
                    "reason": (
                        "Fraudulent evidence: The live rendered webpage does not contain the claimed secret canary token. "
                        "Reporter failed proof-of-exposure."
                    )
                }

            # Truncate content to respect GenVM context limits
            truncated_evidence = raw_evidence[:7000] if len(raw_evidence) > 7000 else raw_evidence

            prompt = f"""You are the Chief Magistrate of the AgentNDA Confidentiality Court on GenLayer.
Evaluate whether the submitted public evidence proves an unauthorized breach of confidential information under the NDA,
with verifiable provenance and attribution to the bound NDA party.

BOUND NDA COUNTERPARTY:
- Party Identifier: {party_id}
- Party Address: {party_addr}
- Protected NDA Topic: {topic_text}
- Authenticated Canary Token (Verified in document): {canary_text}

EXTRACTED PUBLIC EVIDENCE:
{truncated_evidence}

EVALUATION RULES (STRICT GENLAYER ADJUDICATION STANDARDS):
1. Verifiable Provenance & Time-Anchoring:
   - Does the evidence have verifiable provenance (e.g. from an established publication, GitHub commit/PR, archive link like web.archive.org, or public repository)?
   - Reject ephemeral burner pages created without provenance.
2. Attribution to Bound NDA Party:
   - Does the disclosure originate from, directly mention, or compromise assets/secrets associated with the bound NDA party ({party_id})?
3. Material Canary Exposure:
   - Confirm that the secret canary ({canary_text}) and confidential information under '{topic_text}' were genuinely exposed.
4. Output "BREACH_CONFIRMED" if leak_severity >= 70, canary presence is verified, and attribution/provenance is established.
   Otherwise output "NO_BREACH".

Respond ONLY with valid JSON without markdown code fences or formatting:
{{
  "verdict": "BREACH_CONFIRMED"|"NO_BREACH",
  "confidence": <0-100>,
  "leak_severity": <0-100>,
  "reason": "<rigorous assessment of provenance, party attribution, and unauthorized disclosure>"
}}"""

            raw_res = gl.nondet.exec_prompt(prompt, response_format="json")

            parsed = None
            if isinstance(raw_res, dict):
                parsed = raw_res
            elif isinstance(raw_res, str):
                cleaned = raw_res.strip()
                if cleaned.startswith("```json"):
                    cleaned = cleaned[7:]
                elif cleaned.startswith("```"):
                    cleaned = cleaned[3:]
                if cleaned.endswith("```"):
                    cleaned = cleaned[:-3]
                cleaned = cleaned.strip()
                try:
                    parsed = json.loads(cleaned)
                except Exception:
                    pass

            if not parsed or "verdict" not in parsed:
                return {
                    "verdict": "NO_BREACH",
                    "confidence": 50,
                    "leak_severity": 0,
                    "reason": "Consensus failed to parse validator output."
                }

            verdict_str = str(parsed.get("verdict", "")).strip().upper()
            if verdict_str not in ("BREACH_CONFIRMED", "NO_BREACH"):
                verdict_str = "NO_BREACH"

            def _clean_num(val, default):
                try:
                    s = int(val)
                    return max(0, min(100, s))
                except Exception:
                    return default

            conf_val = _clean_num(parsed.get("confidence"), 85)
            sev_val = _clean_num(parsed.get("leak_severity"), 85 if verdict_str == "BREACH_CONFIRMED" else 15)
            reason_str = str(parsed.get("reason", "Consensus audit concluded."))

            evidence_hash = hashlib.sha256(raw_evidence.encode("utf-8")).hexdigest()
            canary_matched = (canary_text.lower() in raw_evidence.lower())

            return {
                "verdict": verdict_str,
                "confidence": conf_val,
                "leak_severity": sev_val,
                "reason": reason_str,
                "canary_found": True if (verdict_str == "BREACH_CONFIRMED" and canary_matched) else False,
                "party_attributed": True if verdict_str == "BREACH_CONFIRMED" else False,
                "evidence_hash": evidence_hash,
            }

        def validator_fn(leader_res) -> bool:
            if not isinstance(leader_res, gl.vm.Return):
                return False
            leader = leader_res.calldata
            if isinstance(leader, str):
                try:
                    leader = json.loads(leader)
                except Exception:
                    return False
            if not isinstance(leader, dict) or "verdict" not in leader:
                return False

            mine = leader_fn()

            # 1. Semantic Verdict Agreement
            if mine["verdict"] != leader["verdict"]:
                return False

            # 2. Enhanced Equivalence Principle:
            # When breach is confirmed, validators must agree on key factual findings and severity bounds
            if mine["verdict"] == "BREACH_CONFIRMED":
                # Factual findings: both validators must agree canary was found and party attributed
                if leader.get("canary_found") is not True or mine.get("canary_found") is not True:
                    return False
                if leader.get("party_attributed") is not True or mine.get("party_attributed") is not True:
                    return False
                # Severity bounds: discrepancy must not exceed 20 points
                leader_sev = int(leader.get("leak_severity", 0))
                mine_sev = int(mine.get("leak_severity", 0))
                if abs(leader_sev - mine_sev) > 20:
                    return False
                # Evidence snapshot hash consistency
                if leader.get("evidence_hash") != mine.get("evidence_hash"):
                    return False

            return True

        adjudication_res = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = adjudication_res["verdict"]
        reason = adjudication_res["reason"]
        confidence = u8(int(adjudication_res["confidence"]))
        leak_severity = u8(int(adjudication_res["leak_severity"]))

        c.verdict = verdict
        c.reason = reason
        c.confidence = confidence
        c.leak_severity = leak_severity
        if "evidence_hash" in adjudication_res and adjudication_res["evidence_hash"]:
            c.evidence_hash = str(adjudication_res["evidence_hash"])

        bounty_val = c.bounty_amount
        bond_val = c.reporter_bond
        c.reporter_bond = bigint(0)

        if verdict == "BREACH_CONFIRMED":
            c.status = u8(2)  # BREACH_CONFIRMED
            self.total_bounty_locked = self.total_bounty_locked - bounty_val
            self.total_breaches_settled = self.total_breaches_settled + u32(1)
            # Reward whistleblower: Payout bounty + refund their anti-spam bond
            total_reward = bounty_val + bond_val
            gl.get_contract_at(c.whistleblower).emit_transfer(value=u256(total_reward))
        else:
            # Confirmed false alarm / unverified provenance / invalid or 404 URL: Slash bond to compensate issuer, reset case
            c.status = u8(0)  # Reset to ACTIVE_SECURE
            c.verdict = "NO_BREACH"
            if bond_val > bigint(0):
                gl.get_contract_at(c.issuer).emit_transfer(value=u256(bond_val))

    @gl.public.write
    def close_and_reclaim(self, case_id: u64) -> None:
        """
        Issuer can reclaim escrowed funds when contract terms expire without confirmed breach.
        Includes timeout protection if an audit stalled (> 24 hours).
        """
        if case_id not in self.cases:
            raise ValueError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if gl.message.sender_address != c.issuer:
            raise ValueError("Only the NDA issuer can reclaim funds.")

        now = self._get_current_timestamp()

        if c.status == u8(1):
            if now > u256(0) and c.audit_started_at > u256(0) and now < (c.audit_started_at + u256(86400)):
                raise ValueError("Cannot reclaim: Case is currently undergoing active jury audit (24h protection).")
            bond_val = c.reporter_bond
            c.reporter_bond = bigint(0)
            if bond_val > bigint(0):
                gl.get_contract_at(c.whistleblower).emit_transfer(value=u256(bond_val))
        elif c.status == u8(0):
            if now > u256(0) and c.expires_at_timestamp > u256(0) and now < c.expires_at_timestamp:
                raise ValueError("Cannot reclaim: Protected NDA confidentiality duration has not yet expired.")
        else:
            raise ValueError("Case is already settled or reclaimed.")

        c.status = u8(3)  # SECURE_EXPIRED
        c.verdict = "SECURE_EXPIRED"
        c.reason = "Protected period expired with zero confirmed leaks. Funds reclaimed by issuer."

        bounty_val = c.bounty_amount
        self.total_bounty_locked = self.total_bounty_locked - bounty_val

        # Refund bounty to issuer
        gl.get_contract_at(c.issuer).emit_transfer(value=u256(bounty_val))

    # --- Read-only Views ---

    @gl.public.view
    def get_case(self, case_id: u64) -> str:
        """Returns JSON serialized representation of an NDA case with canary privacy protection."""
        if case_id not in self.cases:
            raise ValueError(f"Case {case_id} does not exist.")

        return json.dumps(_format_case_dict(self.cases[case_id]))

    @gl.public.view
    def get_case_count(self) -> int:
        return len(self.case_ids)

    @gl.public.view
    def get_case_id_by_index(self, idx: int) -> u64:
        if idx < 0 or idx >= len(self.case_ids):
            raise IndexError("Index out of bounds.")
        return self.case_ids[idx]

    @gl.public.view
    def get_cases_paginated(self, offset: int, limit: int) -> str:
        """Safely paginates cases to avoid GenVM out-of-memory errors."""
        total = len(self.case_ids)
        if offset < 0 or offset >= total or limit <= 0:
            return json.dumps([])

        end = min(offset + limit, total)
        cases_list = []
        for i in range(offset, end):
            cid = self.case_ids[i]
            cases_list.append(_format_case_dict(self.cases[cid]))
        return json.dumps(cases_list)

    @gl.public.view
    def get_all_cases(self) -> str:
        """Returns JSON serialized array of all NDA cases with privacy protection."""
        cases_list = []
        for cid in self.case_ids:
            cases_list.append(_format_case_dict(self.cases[cid]))
        return json.dumps(cases_list)

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_cases": len(self.case_ids),
            "total_bounty_locked": str(self.total_bounty_locked),
            "total_breaches_settled": int(self.total_breaches_settled),
        }
        return json.dumps(data)
