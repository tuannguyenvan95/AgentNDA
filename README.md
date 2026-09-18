# 🛡️ AgentNDA — Autonomous Web3 Leak Adjudication & Whistleblower Bounty Escrow

[![GenLayer](https://img.shields.io/badge/GenLayer-Studionet-6366f1?style=for-the-badge&logo=ethereum)](https://studio.genlayer.com)
[![Consensus](https://img.shields.io/badge/Consensus-Optimistic_Democracy-06b6d4?style=for-the-badge)](https://docs.genlayer.com)
[![Track](https://img.shields.io/badge/Track-Subjective_Consensus_&_AI_Governance-10b981?style=for-the-badge)](https://portal.genlayer.foundation)
[![License](https://img.shields.io/badge/License-MIT-f43f5e?style=for-the-badge)](LICENSE)

> **One-Liner (Form Ready — 109 chars):**  
> Autonomous Web3 leak adjudication and whistleblower escrow powered by GenLayer decentralized AI consensus.

---

## 🎯 1. Bối cảnh & Khoảng trống pháp lý Web3 (The Problem)

Trong nền kinh tế AI và Web3 (Agentic Economy), các DAO, công ty AI và quỹ đầu tư thường xuyên thuê các Sub-Agent, chuyên gia kiểm thử bảo mật (auditors), hoặc cố vấn chiến lược tiếp cận các tài liệu tối mật:
- Mã nguồn giao thức chưa công bố (zero-day, unreleased circuits).
- Kế hoạch niêm yết token, thời điểm TGE, định giá private round.
- Kiến trúc mô hình AI độc quyền, trọng số và bộ dữ liệu huấn luyện.

### Vấn đề nan giải:
1. **Hợp đồng NDA truyền thống (Paper NDAs) hoàn toàn vô hiệu:** Trong môi trường Web3, các bên tham gia giao dịch ẩn danh (pseudonymous wallets). Không ai biết danh tính ngoài đời thực để kiện ra tòa án dân sự truyền thống.
2. **Smart Contract thông thường (Solidity / EVM) bất lực:** Solidity là máy tính toán đóng — không thể tự đọc Twitter/X, Pastebin, blog kỹ thuật hay diễn đàn hacker để phát hiện rò rỉ. Solidity cũng không thể hiểu tính tương đồng ngữ nghĩa (semantic equivalence) giữa tài liệu mật và bài viết công khai nếu không phụ thuộc vào các oracle tập trung dễ bị thao túng.

---

## ⚡ 2. Điểm Độc Lạ — Vì sao dự án SẬP nếu không có GenLayer? (The Unique Hook)

AgentNDA biến hợp đồng bảo mật thành **cam kết kinh tế tự hành (Autonomous Economic Escrow)** trên GenLayer:

```
┌─────────────────┐       Lock GEN Bounty + Canary Words        ┌────────────────────────┐
│  Issuer (DAO)   ├────────────────────────────────────────────►│  AgentNDA Escrow       │
└─────────────────┘                                             └───────────┬────────────┘
                                                                            │
┌─────────────────┐       Submits Public Leak URL (Twitter/Pastebin)│
│  Whistleblower  ├─────────────────────────────────────────────────┤
└─────────────────┘                                                 │ Status: IN_AUDIT
                                                                    ▼
                                                        ┌────────────────────────┐
                                                        │  GenLayer AI Jury      │
                                                        │  gl.nondet.web.render  │
                                                        │  gl.vm.run_nondet      │
                                                        └───────────┬────────────┘
                                                                    │
                                     Consensus Verdict reached:     │
                     ┌──────────────────────────────────────────────┴─────────────────────────────────┐
                     ▼                                                                                ▼
             BREACH_CONFIRMED                                                                     NO_BREACH
      (Material canary breach proven)                                                    (False alarm / community rumor)
                     │                                                                                │
                     ▼                                                                                ▼
   100% Escrow Bounty paid autonomously                                              Escrow resets to ACTIVE_SECURE.
 to Whistleblower via `emit_transfer`                                                 No funds lost. Investigation closed.
```

### Ba trụ cột độc quyền của GenLayer:
1. **Live Web Access trực tiếp trên chuỗi (`gl.nondet.web.render`):** Bồi thẩm đoàn validator cào live toàn bộ nội dung của link bài viết bị nghi rò rỉ mà không cần qua bất kỳ trung gian hay oracle tập trung nào.
2. **Đồng thuận Ngữ nghĩa Bất đồng bộ (Semantic Consensus via `gl.vm.run_nondet`):** Nhiều validator chạy các mô hình LLM độc lập để phân tích: *Bài viết có thực sự chứa các chi tiết bí mật hoặc Canary Tokens không?* và đạt đồng thuận trên **VERDICT** (`BREACH_CONFIRMED` / `NO_BREACH`), bỏ qua khác biệt câu chữ giải trình của từng LLM.
3. **Giải ngân Tự động (`emit_transfer`):** Khi vi phạm được chứng minh, quỹ thưởng được giải ngân ngay lập tức cho Whistleblower. Nếu hợp đồng hết hạn bảo mật mà không có rò rỉ, bên phát hành được hoàn trả toàn bộ số tiền.

---

## 🛡️ 3. Kiến trúc Smart Contract (`contracts/contract.py`)

Smart contract tuân thủ 100% các tiêu chuẩn phát triển của GenLayer Studionet:
- **Pragma version:** `# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }` ở dòng 1.
- **Import an toàn:** `from genlayer import *` (không alias `import genlayer as gl`).
- **Struct lưu trữ:** `@allow_storage @dataclass class NDACase` sử dụng `bigint`, `u8`, `u32`, `u64`, `u256`, `Address`, `str`. Cấm `dict`, `list`, bare `int`, `float`.
- **Khởi tạo:** GenVM tự khởi tạo `TreeMap` và `DynArray` — tuyệt đối không gán đè trong `__init__`.
- **Thanh toán Native GEN:** Dùng `gl.get_contract_at(recipient).emit_transfer(value=u256(amount))` (không dùng `gl.eth.send_value`).

### Các phương thức cốt lõi:
| Phương thức | Loại | Mô tả |
|---|---|---|
| `register_nda_escrow(nda_scope)` | `@gl.public.write.payable` | Khóa GEN vào quỹ thưởng, thiết lập tiêu chí bí mật & Canary Token. |
| `report_leak(case_id, evidence_url)` | `@gl.public.write` | Whistleblower nộp URL bằng chứng rò rỉ công khai trên mạng. |
| `adjudicate_leak(case_id)` | `@gl.public.write` | Kích hoạt bồi thẩm đoàn AI cào web và thẩm định vi phạm. |
| `close_and_reclaim(case_id)` | `@gl.public.write` | Issuer rút lại quỹ bảo chứng sau khi hết hạn bảo mật an toàn. |
| `get_case(case_id)` | `@gl.public.view` | Trả về thông tin chi tiết của vụ việc dưới dạng JSON. |
| `get_all_cases()` | `@gl.public.view` | Trả về mảng JSON chứa toàn bộ các vụ việc để frontend nạp nhanh. |
| `get_stats()` | `@gl.public.view` | Trả về tổng quỹ đang khóa và số vụ việc rò rỉ đã xử lý. |

---

## 🚀 4. Hướng dẫn Triển khai trên GenLayer Studionet

### Bước 1: Mở GenLayer Studio
1. Truy cập [GenLayer Studio Run & Debug](https://studio.genlayer.com/run-debug).
2. Vào mục **Settings** -> nhấn **Reset Storage** -> Xác nhận (để dọn dẹp cache môi trường).
3. Hard refresh trình duyệt (`Ctrl + Shift + R` hoặc `Cmd + Shift + R`).

### Bước 2: Deploy Intelligent Contract
1. Trong panel **Contracts**, tạo file mới: `contracts/contract.py`.
2. Copy toàn bộ nội dung từ file `contracts/contract.py` của dự án dán vào.
3. Chuyển sang panel **Run & Debug**:
   - Chọn contract `Contract`.
   - Nhấn **Deploy**.
4. Sau khi transaction hoàn thành, nhấn vào transaction để kiểm tra chắc chắn hiển thị **`Result: SUCCESS`** (không chỉ nhìn `Status: FINALIZED`).
5. Copy địa chỉ contract vừa deploy (ví dụ: `0x...`).

### Bước 3: Chuẩn bị Ví MetaMask
1. Thêm mạng GenLayer Studionet vào MetaMask:
   - **Network Name:** GenLayer Studionet
   - **RPC URL:** `https://studio.genlayer.com/api`
   - **Chain ID:** `61999` (Hex: `0xF22F` hoặc `0xF1EF`)
   - **Symbol:** `GEN` (18 decimals)
   - **Explorer:** `https://genlayer-explorer.vercel.app`
2. **Nạp GEN cho ví:** Vào tab **Accounts** trong GenLayer Studio, chọn một tài khoản có sẵn số dư lớn, thực hiện chuyển **10–50 GEN** sang địa chỉ MetaMask của bạn. *(Lưu ý: Không dùng faucet testnet vì faucet đó chỉ cấp cho Asimov/Bradbury, không thông với Studionet).*

---

## 💻 5. Chạy Frontend dApp Local

### Cài đặt & Chạy:
```bash
cd frontend
cmd /c npm install
cmd /c npm run dev
```
Mở trình duyệt tại `http://localhost:3000`.

### Cấu hình Contract Address trong giao diện:
1. Nhấn nút biểu tượng bánh răng **Settings** trên thanh Navbar.
2. Dán địa chỉ contract vừa deploy trên Studio vào ô và nhấn **Save Address**.
3. DApp sẽ tự động nạp trạng thái từ Studionet RPC.

---

## 🧪 6. Chạy Bộ Test Tự Động (Pytest)

Dự án đi kèm bộ test toàn diện 8/8 test cases kiểm tra cú pháp, cấu trúc dữ liệu, cơ chế đồng thuận ngữ nghĩa và mô phỏng GenVM:

```bash
pytest tests/
```

Kết quả:
```text
tests/test_agentnda.py ........ [100%]
============================== 8 passed in 0.13s ==============================
```

Các ca kiểm thử bao gồm:
- ✅ Cú pháp, header pragma version và khai báo methods.
- ✅ Cấu trúc `NDACase` đầy đủ các trường dữ liệu theo chuẩn.
- ✅ Luật Semantic Consensus: validator chỉ so khớp `verdict`.
- ✅ Chuyển tiền native qua `gl.get_contract_at(...).emit_transfer(...)`.
- ✅ Vòng đời rò rỉ thành công: nạp quỹ -> báo rò rỉ -> AI xác nhận `BREACH_CONFIRMED` -> giải ngân cho Whistleblower.
- ✅ Báo tin thất thiệt: AI phân xử `NO_BREACH` -> trạng thái trở về `ACTIVE_SECURE`, bảo toàn quỹ.
- ✅ Hết hạn an toàn: Issuer rút lại tiền thành công qua `close_and_reclaim`.
- ✅ Bảo mật quyền truy cập (RBAC) và kiểm tra định dạng dữ liệu đầu vào.

---

## 📝 7. Thông tin Nộp bài Portal & Explorer (Submission Specifications)

- **Project Name:** AgentNDA
- **Primary Category:** `Dispute Resolution` *(Hoặc `Governance`)*
- **Category Tag 1:** `Evidence Assessment` *(Contract nhận URL bằng chứng web và đối chiếu với điều khoản bí mật)*
- **Category Tag 2:** `Escrow Claims` *(Khóa quỹ bảo chứng có điều kiện giải ngân tự động)*
- **Deployment Status:** `Preview` *(Theo quy định của GenLayer: deploy trên Studionet = Preview, testnet = Live)*
- **One-liner (109 ký tự / Giới hạn 180):**
  ```text
  Autonomous Web3 leak adjudication and whistleblower escrow powered by GenLayer decentralized AI consensus.
  ```
- **Description (788 ký tự / Giới hạn 1000):**
  ```text
  AgentNDA provides autonomous leak adjudication and whistleblower escrow for the agentic economy. Traditional paper NDAs are completely unenforceable among anonymous Web3 actors, and legacy smart contracts cannot read the public web.

  AgentNDA enables organizations to lock native GEN bounty pools specifying confidential criteria and canary tokens. When leaks surface on Twitter/X, Pastebin, or technical blogs, whistleblowers report the URL on-chain. GenLayer validators execute gl.nondet.web.render to extract live evidence without centralized oracles, assess material disclosure via decentralized LLM consensus, and settle verdicts (BREACH_CONFIRMED vs NO_BREACH). Proven breaches automatically pay out bounties to whistleblowers; expired safe periods refund the issuer.
  ```
- **Expected Verification Outcome (432 ký tự / Giới hạn 500):**
  ```text
  Reviewer connects MetaMask on Studionet, selects an active NDA case, and reports a leak URL. Triggering "AI Jury Adjudication" convenes GenLayer validators to scrape the link and evaluate the canary terms on-chain. The case status advances to BREACH_CONFIRMED with an AI rationale and severity score, autonomously transferring the GEN bounty to the whistleblower's wallet, with all actions verifiable on the GenLayer Explorer.
  ```

---

## 📜 Giấy phép
Mã nguồn mở theo giấy phép MIT. Được thiết kế dành cho GenLayer Builder Program & Agent Tank Hackathon.
