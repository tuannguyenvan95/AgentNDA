# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


def _addr_str(addr: Address) -> str:
    """Safely format an Address instance into a hex string."""
    try:
        return addr.as_hex
    except Exception:
        return str(addr)


@allow_storage
@dataclass
class NDACase:
    """Storage struct representing an on-chain autonomous NDA and leak escrow."""
    case_id: str
    issuer: Address
    whistleblower: Address
    bounty_amount: bigint
    reporter_bond: bigint         # Anti-spam deposit staked by whistleblower
    nda_scope: str                 # Confidential criteria, trade secrets, canary identifiers
    evidence_url: str              # Public URL of leaked article, post, or pastebin
    status: u8                     # 0: ACTIVE_SECURE, 1: IN_AUDIT, 2: BREACH_CONFIRMED, 3: SECURE_EXPIRED
    verdict: str                   # "PENDING", "BREACH_CONFIRMED", "NO_BREACH", "FETCH_FAILED", "SECURE_EXPIRED"
    reason: str                    # Detailed jury breach justification
    confidence: u8                 # 0 - 100: Validator consensus confidence
    leak_severity: u8              # 0 - 100: Degree of confidential exposure
    created_at_timestamp: u256
    expires_at_timestamp: u256     # Timestamp after which issuer can reclaim funds
    audit_started_at: u256         # Timestamp when report_leak was triggered (for timeout protection)


class Contract(gl.Contract):
    """
    AgentNDA: Autonomous Web3 Leak Adjudication and Whistleblower Bounty Escrow
    Target Network: studionet (Chain ID: 61999)
    """
    cases: TreeMap[str, NDACase]
    case_ids: DynArray[str]
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
        if hasattr(gl, "message_raw") and isinstance(gl.message_raw, dict):
            dt_raw = gl.message_raw.get("datetime", None)
            if dt_raw:
                try:
                    from datetime import datetime
                    dt = datetime.fromisoformat(str(dt_raw).replace("Z", "+00:00"))
                    ts = int(dt.timestamp())
                    if ts > 0:
                        return u256(ts)
                except Exception:
                    pass
        return u256(0)

    @gl.public.write.payable
    def register_nda_escrow(self, nda_scope: str, duration_seconds: int) -> str:
        """
        Issuer locks native GEN bounty pool, registers confidential scope, and sets duration.
        """
        bounty = bigint(gl.message.value)
        if bounty <= bigint(0):
            raise gl.UserError("NDA escrow bounty must be greater than 0 GEN.")

        if not nda_scope or len(nda_scope.strip()) == 0:
            raise gl.UserError("NDA confidential scope definition cannot be empty.")

        duration = u256(duration_seconds if duration_seconds > 0 else 604800)

        self.case_counter = self.case_counter + u64(1)
        case_id = f"nda-{int(self.case_counter)}"
        now = self._get_current_timestamp()
        expires_at = now + duration
        empty_whistleblower = Address("0x0000000000000000000000000000000000000000")

        new_case = NDACase(
            case_id=case_id,
            issuer=gl.message.sender_address,
            whistleblower=empty_whistleblower,
            bounty_amount=bounty,
            reporter_bond=bigint(0),
            nda_scope=nda_scope.strip(),
            evidence_url="",
            status=u8(0),  # ACTIVE_SECURE
            verdict="PENDING",
            reason="NDA active. Awaiting leak evidence or contract expiration.",
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
    def report_leak(self, case_id: str, evidence_url: str) -> None:
        """
        Whistleblower submits evidence URL. Staking a small bond prevents spam DoS attacks.
        """
        if case_id not in self.cases:
            raise gl.UserError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if c.status != u8(0):
            raise gl.UserError(f"Case {case_id} is not in ACTIVE_SECURE status.")

        clean_url = evidence_url.strip()
        if not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            raise gl.UserError("Valid public leak evidence URL (http/https) is required.")

        # Minimum anti-spam bond: 5% of bounty (or at least 1 wei)
        min_bond = c.bounty_amount // bigint(20)
        if min_bond == bigint(0):
            min_bond = bigint(1)

        bond_sent = bigint(gl.message.value)
        if bond_sent < min_bond:
            raise gl.UserError(f"Whistleblower must stake anti-spam bond of at least {int(min_bond)} wei.")

        c.whistleblower = gl.message.sender_address
        c.evidence_url = clean_url
        c.reporter_bond = bond_sent
        c.status = u8(1)  # IN_AUDIT
        c.audit_started_at = self._get_current_timestamp()
        c.reason = "Leak report filed with staked bond. AI jury investigating disclosure."

    @gl.public.write
    def adjudicate_leak(self, case_id: str) -> None:
        """
        AI Jury fetches evidence URL via gl.nondet.web.render, compares extracted content
        against protected NDA criteria, and reaches consensus on the VERDICT.
        """
        if case_id not in self.cases:
            raise gl.UserError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if c.status != u8(1):
            raise gl.UserError(f"Case {case_id} is not awaiting leak adjudication.")

        evidence_url = c.evidence_url
        scope_text = c.nda_scope

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

            # Truncate content to respect GenVM context limits
            truncated_evidence = raw_evidence[:7000] if len(raw_evidence) > 7000 else raw_evidence

            prompt = f"""You are the Chief Magistrate of the AgentNDA Confidentiality Court on GenLayer.
Evaluate whether the submitted public evidence proves an unauthorized breach of confidential information under the NDA.

PROTECTED NDA SCOPE AND CANARY IDENTIFIERS:
{scope_text}

EXTRACTED PUBLIC EVIDENCE:
{truncated_evidence}

EVALUATION RULES:
1. Material Exposure: Does the evidence disclose specific confidential secrets, internal plans, code, or canary terms specified in the scope?
2. Genuine Breach vs Rumor: Distinguish verified leaked facts from unrelated public rumors or coincidence.
3. Compute leak_severity (0-100).
4. Output "BREACH_CONFIRMED" if leak_severity >= 70 and scope violations are undeniable.
   Otherwise output "NO_BREACH".

Respond ONLY with valid JSON without markdown code fences or formatting:
{{
  "verdict": "BREACH_CONFIRMED"|"NO_BREACH",
  "confidence": <0-100>,
  "leak_severity": <0-100>,
  "reason": "<rigorous assessment of unauthorized disclosure>"
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

            return {
                "verdict": verdict_str,
                "confidence": conf_val,
                "leak_severity": sev_val,
                "reason": reason_str
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
            # Semantic Consensus: Compare VERDICT ONLY!
            return mine["verdict"] == leader["verdict"]

        adjudication_res = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = adjudication_res["verdict"]
        reason = adjudication_res["reason"]
        confidence = u8(int(adjudication_res["confidence"]))
        leak_severity = u8(int(adjudication_res["leak_severity"]))

        c.verdict = verdict
        c.reason = reason
        c.confidence = confidence
        c.leak_severity = leak_severity

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
            # Confirmed false alarm / no leak / invalid or 404 URL: Slash bond to compensate issuer, reset case
            c.status = u8(0)  # Reset to ACTIVE_SECURE
            c.verdict = "NO_BREACH"
            if bond_val > bigint(0):
                gl.get_contract_at(c.issuer).emit_transfer(value=u256(bond_val))

    @gl.public.write
    def close_and_reclaim(self, case_id: str) -> None:
        """
        Issuer can reclaim escrowed funds when contract terms expire without confirmed breach.
        Includes timeout protection if an audit stalled (> 24 hours).
        """
        if case_id not in self.cases:
            raise gl.UserError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        if gl.message.sender_address != c.issuer:
            raise gl.UserError("Only the NDA issuer can reclaim funds.")

        now = self._get_current_timestamp()

        # Enforce time-lock when real execution timestamp is available from GenLayer context
        if now > u256(0) and c.expires_at_timestamp > u256(0):
            if c.status == u8(1):
                if now < (c.audit_started_at + u256(86400)):
                    raise gl.UserError("Cannot reclaim: Case is currently undergoing active jury audit (24h protection).")
                bond_val = c.reporter_bond
                c.reporter_bond = bigint(0)
                if bond_val > bigint(0):
                    gl.get_contract_at(c.whistleblower).emit_transfer(value=u256(bond_val))
            elif c.status == u8(0):
                if now < c.expires_at_timestamp:
                    raise gl.UserError("Cannot reclaim: Protected NDA confidentiality duration has not yet expired.")
            else:
                raise gl.UserError("Case is already settled or reclaimed.")
        else:
            # Fallback for mock/simulation environments where datetime is absent:
            if c.status == u8(1):
                bond_val = c.reporter_bond
                c.reporter_bond = bigint(0)
                if bond_val > bigint(0):
                    gl.get_contract_at(c.whistleblower).emit_transfer(value=u256(bond_val))
            elif c.status != u8(0):
                raise gl.UserError("Case is already settled or reclaimed.")

        c.status = u8(3)  # SECURE_EXPIRED
        c.verdict = "SECURE_EXPIRED"
        c.reason = "Protected period expired with zero confirmed leaks. Funds reclaimed by issuer."

        bounty_val = c.bounty_amount
        self.total_bounty_locked = self.total_bounty_locked - bounty_val

        # Refund bounty to issuer
        gl.get_contract_at(c.issuer).emit_transfer(value=u256(bounty_val))

    # --- Read-only Views ---

    @gl.public.view
    def get_case(self, case_id: str) -> str:
        """Returns JSON serialized representation of an NDA case."""
        if case_id not in self.cases:
            raise gl.UserError(f"Case {case_id} does not exist.")

        c = self.cases[case_id]
        data = {
            "case_id": c.case_id,
            "issuer": _addr_str(c.issuer),
            "whistleblower": _addr_str(c.whistleblower),
            "bounty_amount": str(c.bounty_amount),
            "reporter_bond": str(c.reporter_bond),
            "nda_scope": c.nda_scope,
            "evidence_url": c.evidence_url,
            "status": int(c.status),
            "verdict": c.verdict,
            "reason": c.reason,
            "confidence": int(c.confidence),
            "leak_severity": int(c.leak_severity),
            "created_at_timestamp": str(c.created_at_timestamp),
            "expires_at_timestamp": str(c.expires_at_timestamp),
        }
        return json.dumps(data)

    @gl.public.view
    def get_case_count(self) -> int:
        return len(self.case_ids)

    @gl.public.view
    def get_case_id_by_index(self, idx: int) -> str:
        if idx < 0 or idx >= len(self.case_ids):
            raise gl.UserError("Index out of bounds.")
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
            c = self.cases[cid]
            cases_list.append({
                "case_id": c.case_id,
                "issuer": _addr_str(c.issuer),
                "whistleblower": _addr_str(c.whistleblower),
                "bounty_amount": str(c.bounty_amount),
                "reporter_bond": str(c.reporter_bond),
                "nda_scope": c.nda_scope,
                "evidence_url": c.evidence_url,
                "status": int(c.status),
                "verdict": c.verdict,
                "reason": c.reason,
                "confidence": int(c.confidence),
                "leak_severity": int(c.leak_severity),
                "created_at_timestamp": str(c.created_at_timestamp),
                "expires_at_timestamp": str(c.expires_at_timestamp),
            })
        return json.dumps(cases_list)

    @gl.public.view
    def get_all_cases(self) -> str:
        """Returns JSON serialized array of all NDA cases for backward compatibility."""
        cases_list = []
        for cid in self.case_ids:
            c = self.cases[cid]
            cases_list.append({
                "case_id": c.case_id,
                "issuer": _addr_str(c.issuer),
                "whistleblower": _addr_str(c.whistleblower),
                "bounty_amount": str(c.bounty_amount),
                "reporter_bond": str(c.reporter_bond),
                "nda_scope": c.nda_scope,
                "evidence_url": c.evidence_url,
                "status": int(c.status),
                "verdict": c.verdict,
                "reason": c.reason,
                "confidence": int(c.confidence),
                "leak_severity": int(c.leak_severity),
                "created_at_timestamp": str(c.created_at_timestamp),
                "expires_at_timestamp": str(c.expires_at_timestamp),
            })
        return json.dumps(cases_list)

    @gl.public.view
    def get_stats(self) -> str:
        data = {
            "total_cases": len(self.case_ids),
            "total_bounty_locked": str(self.total_bounty_locked),
            "total_breaches_settled": int(self.total_breaches_settled),
        }
        return json.dumps(data)
