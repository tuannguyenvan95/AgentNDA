import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Loader2,
  PlusCircle,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Scale,
  AlertOctagon,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { StatsBar } from './components/StatsBar';
import { CaseCard } from './components/CaseCard';
import { RegisterNDA } from './components/RegisterNDA';
import { ReportLeak } from './components/ReportLeak';
import { BreachJuryModal } from './components/BreachJuryModal';
import {
  getSavedContractAddress,
  saveContractAddress,
  fetchStudionetBalance,
  fetchStats,
  fetchAllCases,
  adjudicateLeakOnChain,
  closeAndReclaimOnChain,
  ensureStudionet,
  NDACaseData,
  ProtocolStats,
} from './config/genlayer';
import { formatGen } from './utils/helpers';

export const App: React.FC = () => {
  // Wallet State
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0.00');
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Contract State
  const [contractAddress, setContractAddress] = useState<string>(getSavedContractAddress());
  const [stats, setStats] = useState<ProtocolStats>({
    total_cases: 0,
    total_bounty_locked: '0',
    total_breaches_settled: 0,
  });
  const [cases, setCases] = useState<NDACaseData[]>([]);
  const [isLoadingCases, setIsLoadingCases] = useState<boolean>(true);

  // Layout view mode
  const [viewMode, setViewMode] = useState<'newspaper' | 'register' | 'whistleblower' | 'archive'>('newspaper');
  const [filter, setFilter] = useState<'all' | 'active' | 'audit' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action Status
  const [reportModalCase, setReportModalCase] = useState<NDACaseData | null>(null);
  const [juryModalCase, setJuryModalCase] = useState<NDACaseData | null>(null);
  const [txPending, setTxPending] = useState<{ title: string; desc: string } | null>(null);

  // Refresh on-chain state
  const loadOnChainData = useCallback(async () => {
    try {
      const [newStats, newCases] = await Promise.all([
        fetchStats(contractAddress),
        fetchAllCases(contractAddress),
      ]);
      setStats(newStats);
      setCases(newCases);
    } catch (e) {
      console.error('Error refreshing on-chain state:', e);
    } finally {
      setIsLoadingCases(false);
    }
  }, [contractAddress]);

  // Refresh balance
  const loadBalance = useCallback(async (userAddr: string) => {
    try {
      const bal = await fetchStudionetBalance(userAddr);
      setBalance(bal);
    } catch (e) {
      console.warn('Error loading balance:', e);
    }
  }, []);

  // Connect MetaMask Wallet
  const handleConnectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert('MetaMask is not installed. Please install MetaMask to use AgentNDA.');
      return;
    }
    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      await ensureStudionet();
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setAccount(accounts[0]);
        await loadBalance(accounts[0]);
      }
      const hexChain = await ethereum.request({ method: 'eth_chainId' });
      setChainId(parseInt(hexChain, 16));
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      alert(err.message || 'Failed to connect MetaMask.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnectWallet = () => {
    setAccount(null);
    setBalance('0.00');
  };

  const handleSwitchNetwork = async () => {
    try {
      await ensureStudionet();
      const hexChain = await (window as any).ethereum.request({ method: 'eth_chainId' });
      setChainId(parseInt(hexChain, 16));
      if (account) loadBalance(account);
    } catch (e: any) {
      alert(e.message || 'Failed to switch network.');
    }
  };

  const handleUpdateContractAddress = (newAddr: string) => {
    saveContractAddress(newAddr);
    setContractAddress(newAddr);
    setIsLoadingCases(true);
  };

  // Trigger AI Jury Adjudication write method
  const handleAdjudicate = async (caseItem: NDACaseData) => {
    if (!account) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }
    setTxPending({
      title: 'Convening On-Chain AI Jury',
      desc: `Validators are executing gl.nondet.web.render on ${caseItem.evidence_url} and evaluating semantic breach via gl.vm.run_nondet...`,
    });
    try {
      await adjudicateLeakOnChain(contractAddress, account, caseItem.case_id);
      await loadOnChainData();
      if (account) loadBalance(account);
      const updated = cases.find((c) => c.case_id === caseItem.case_id) || caseItem;
      setJuryModalCase(updated);
    } catch (err: any) {
      console.error('Adjudication error:', err);
      alert(err.message || 'Adjudication transaction failed.');
    } finally {
      setTxPending(null);
    }
  };

  // Close and reclaim write method
  const handleCloseAndReclaim = async (caseItem: NDACaseData) => {
    if (!account) {
      alert('Please connect your MetaMask wallet first.');
      return;
    }
    setTxPending({
      title: 'Reclaiming Escrow Bond',
      desc: `Refunding bounty of case ${caseItem.case_id} back to issuer.`,
    });
    try {
      await closeAndReclaimOnChain(contractAddress, account, caseItem.case_id);
      await loadOnChainData();
      if (account) loadBalance(account);
    } catch (err: any) {
      console.error('Reclaim error:', err);
      alert(err.message || 'Reclaim transaction failed.');
    } finally {
      setTxPending(null);
    }
  };

  // Listen for MetaMask events
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;

      const handleAccountsChanged = (accs: string[]) => {
        if (accs.length > 0) {
          setAccount(accs[0]);
          loadBalance(accs[0]);
        } else {
          setAccount(null);
          setBalance('0.00');
        }
      };

      const handleChainChanged = (hexChain: string) => {
        const id = parseInt(hexChain, 16);
        setChainId(id);
        if (account) loadBalance(account);
      };

      ethereum.on('accountsChanged', handleAccountsChanged);
      ethereum.on('chainChanged', handleChainChanged);

      ethereum.request({ method: 'eth_accounts' }).then((accs: string[]) => {
        if (accs && accs.length > 0) {
          setAccount(accs[0]);
          loadBalance(accs[0]);
        }
      });
      ethereum.request({ method: 'eth_chainId' }).then((c: string) => {
        setChainId(parseInt(c, 16));
      });

      return () => {
        ethereum.removeListener('accountsChanged', handleAccountsChanged);
        ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, [loadBalance, account]);

  // Periodic polling
  useEffect(() => {
    loadOnChainData();
    const interval = setInterval(loadOnChainData, 10000);
    return () => clearInterval(interval);
  }, [loadOnChainData]);

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    const matchesQuery =
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nda_scope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.issuer.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;
    if (filter === 'active') return c.status === 0;
    if (filter === 'audit') return c.status === 1;
    if (filter === 'settled') return c.status === 2 || c.status === 3;
    return true;
  });

  const activeCasesCount = cases.filter((c) => c.status === 0).length;

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#111827] flex flex-col font-sans">
      {/* Editorial Press Navbar Masthead */}
      <Navbar
        account={account}
        balance={balance}
        isConnecting={isConnecting}
        onConnectWallet={handleConnectWallet}
        onDisconnectWallet={handleDisconnectWallet}
        contractAddress={contractAddress}
        onUpdateContractAddress={handleUpdateContractAddress}
        chainId={chainId}
        onSwitchNetwork={handleSwitchNetwork}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Front-Page Editorial Headline Banner */}
        <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
          <div className="border-b border-[#E5E5E0] pb-4 mb-4 flex items-center justify-between">
            <span className="press-tag press-tag-neutral text-[10px]">
              LEAD EDITORIAL • SUBJECTIVE CONSENSUS JURISDICTION
            </span>
            <span className="text-xs font-mono text-[#6B7280]">
              GENLAYER TEST HARNESS: STUDIONET
            </span>
          </div>

          <div className="max-w-4xl space-y-3">
            <h1 className="font-serif font-black text-3xl sm:text-5xl text-[#111827] leading-[1.1] tracking-tight">
              Autonomous Web3 Leak Adjudication & Whistleblower Bounty Escrow
            </h1>
            <p className="text-sm sm:text-base text-[#4B5563] leading-relaxed font-serif">
              In an agentic economy of pseudonymous builders and autonomous sub-agents, traditional paper NDAs
              are unenforceable. AgentNDA establishes an on-chain court: decentralized LLM validators directly
              crawl reported web links via <code className="text-[#111827] bg-[#F3F4F6] px-1 py-0.5 rounded font-mono text-xs">gl.nondet.web.render</code>,
              adjudicate material leaks through semantic consensus, and instantaneously disburse bounty rewards to whistleblowers.
            </p>
          </div>

          {/* Quick Action Pills */}
          <div className="mt-6 pt-4 border-t border-[#E5E5E0] flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setViewMode('newspaper')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'newspaper'
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#F9F8F6] border border-[#E5E5E0] text-[#374151] hover:bg-[#F3F4F6]'
                }`}
              >
                <span>3-Column Gazette View</span>
              </button>
              <button
                onClick={() => setViewMode('register')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'register'
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#F9F8F6] border border-[#E5E5E0] text-[#374151] hover:bg-[#F3F4F6]'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Issue Escrow Docket</span>
              </button>
              <button
                onClick={() => setViewMode('whistleblower')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'whistleblower'
                    ? 'bg-[#B91C1C] text-white'
                    : 'bg-[#FEF2F2] border border-[#FCA5A5] text-[#B91C1C] hover:bg-[#FEE2E2]'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Whistleblower Tip Line</span>
              </button>
              <button
                onClick={() => setViewMode('archive')}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'archive'
                    ? 'bg-[#111827] text-white'
                    : 'bg-[#F9F8F6] border border-[#E5E5E0] text-[#374151] hover:bg-[#F3F4F6]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Jurisprudence & Precedent</span>
              </button>
            </div>

            <button
              onClick={loadOnChainData}
              disabled={isLoadingCases}
              className="px-3 py-1.5 rounded-md bg-[#FFFFFF] border border-[#E5E5E0] hover:bg-[#F3F4F6] text-xs font-medium text-[#4B5563] flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCases ? 'animate-spin text-[#111827]' : ''}`} />
              <span className="font-mono">Sync Ledger</span>
            </button>
          </div>
        </div>

        {/* Index Statistics Strip */}
        <StatsBar stats={stats} activeCount={activeCasesCount} />

        {/* ========================================================================= */}
        {/* NEWSPAPER 3-COLUMN GRID LAYOUT WITH CLEAR DIVIDING BORDER LINES */}
        {/* ========================================================================= */}
        {viewMode === 'newspaper' && (
          <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl shadow-xs overflow-hidden">
            {/* Column Headers Ribbon */}
            <div className="grid grid-cols-1 lg:grid-cols-12 border-b border-[#E5E5E0] bg-[#F5F4F0] text-[11px] font-mono text-[#4B5563] font-bold uppercase tracking-wider">
              <div className="lg:col-span-5 p-3 px-5 border-b lg:border-b-0 lg:border-r border-[#E5E5E0] flex items-center justify-between">
                <span>SECTION I: ACTIVE COURT DOCKETS</span>
                <span className="text-xs font-serif font-bold text-[#111827]">
                  {filteredCases.length} LISTED
                </span>
              </div>
              <div className="lg:col-span-4 p-3 px-5 border-b lg:border-b-0 lg:border-r border-[#E5E5E0] flex items-center justify-between">
                <span>SECTION II: WHISTLEBLOWER TELEGRAPH</span>
                <span className="text-[#B91C1C] flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C]" />
                  TIP LINE OPEN
                </span>
              </div>
              <div className="lg:col-span-3 p-3 px-5 flex items-center justify-between">
                <span>SECTION III: COURT PRECEDENT</span>
                <span>GENLAYER</span>
              </div>
            </div>

            {/* 3 Columns Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E5E0]">
              {/* ------------------------------------------------------------- */}
              {/* COLUMN 1: Active Dockets & Escrows (5 cols) */}
              {/* ------------------------------------------------------------- */}
              <div className="lg:col-span-5 p-5 sm:p-6 space-y-4">
                {/* Search & Filter Controls */}
                <div className="space-y-3 pb-2 border-b border-[#E5E5E0]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search dockets, canaries, issuers..."
                      className="w-full pl-8 pr-3 py-1.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] focus:outline-none focus:border-[#111827]"
                    />
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto pb-1">
                    {(['all', 'active', 'audit', 'settled'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition cursor-pointer ${
                          filter === f
                            ? 'bg-[#111827] text-white'
                            : 'bg-[#F9F8F6] border border-[#E5E5E0] text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cases List */}
                {isLoadingCases && cases.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-[#111827] mx-auto" />
                    <p className="text-xs text-[#6B7280]">Hydrating ledger from Studionet...</p>
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="py-16 text-center space-y-3 border border-dashed border-[#E5E5E0] rounded-lg p-6">
                    <Scale className="w-8 h-8 text-[#9CA3AF] mx-auto" />
                    <h4 className="font-serif font-bold text-base text-[#111827]">No Dockets Match Query</h4>
                    <p className="text-xs text-[#6B7280] max-w-xs mx-auto">
                      Create a new confidential escrow bond or reset filters to inspect existing dockets.
                    </p>
                    <button
                      onClick={() => setViewMode('register')}
                      className="px-3 py-1.5 rounded-md bg-[#111827] text-white text-xs font-bold cursor-pointer"
                    >
                      Issue First Docket
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredCases.map((c) => (
                      <CaseCard
                        key={c.case_id}
                        caseItem={c}
                        account={account}
                        onReportLeak={(item) => setReportModalCase(item)}
                        onAdjudicateLeak={handleAdjudicate}
                        onCloseAndReclaim={handleCloseAndReclaim}
                        onViewJuryReport={(item) => setJuryModalCase(item)}
                        isActionPending={txPending !== null}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* COLUMN 2: Fast Registrar & Whistleblower Bureau (4 cols) */}
              {/* ------------------------------------------------------------- */}
              <div className="lg:col-span-4 p-5 sm:p-6 space-y-6 bg-[#FCFBF9]">
                {/* Whistleblower Fast Dispatch */}
                <div className="space-y-3 border-b border-[#E5E5E0] pb-5">
                  <div className="flex items-center gap-2 text-[#B91C1C]">
                    <AlertOctagon className="w-4 h-4" />
                    <h3 className="font-serif font-bold text-lg text-[#111827]">
                      Whistleblower Bureau
                    </h3>
                  </div>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    Have you spotted leaked canary phrases on Pastebin, X/Twitter, or forums?
                    Select an active docket to submit proof.
                  </p>

                  <div className="space-y-2 pt-1">
                    {cases
                      .filter((c) => c.status === 0)
                      .slice(0, 3)
                      .map((c) => (
                        <div
                          key={c.case_id}
                          className="p-3 bg-[#FFFFFF] border border-[#E5E5E0] rounded-lg hover:border-[#B91C1C] transition flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono text-[10px] text-[#6B7280] font-bold">
                              {c.case_id}
                            </span>
                            <div className="font-serif font-bold text-xs text-[#111827]">
                              Bounty: {formatGen(c.bounty_amount)} GEN
                            </div>
                            <p className="text-[10px] text-[#6B7280] font-mono truncate max-w-[180px]">
                              {c.nda_scope}
                            </p>
                          </div>
                          <button
                            onClick={() => setReportModalCase(c)}
                            className="px-2.5 py-1 rounded bg-[#FEF2F2] hover:bg-[#FEE2E2] text-[#B91C1C] text-[11px] font-bold border border-[#FCA5A5] flex-shrink-0 cursor-pointer"
                          >
                            Report Leak
                          </button>
                        </div>
                      ))}

                    {cases.filter((c) => c.status === 0).length === 0 && (
                      <p className="text-xs text-[#6B7280] italic py-2">
                        No active dockets currently pending leak reports.
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Issue Escrow Teaser */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-[#111827]">
                    <PlusCircle className="w-4 h-4" />
                    <h3 className="font-serif font-bold text-lg text-[#111827]">
                      Issue New Escrow Bond
                    </h3>
                  </div>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    Lock native GEN into an autonomous confidentiality contract before disclosing secrets to contractors or sub-agents.
                  </p>
                  <button
                    onClick={() => setViewMode('register')}
                    className="w-full py-2 px-4 rounded-md bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                  >
                    Open Escrow Form
                  </button>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* COLUMN 3: Precedent & Why GenLayer (3 cols) */}
              {/* ------------------------------------------------------------- */}
              <div className="lg:col-span-3 p-5 sm:p-6 space-y-6 bg-[#FFFFFF]">
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#111827] pb-2 border-b border-[#E5E5E0]">
                    Judicial Gazette
                  </h3>
                </div>

                {/* Editorial Precedent 1 */}
                <article className="space-y-2 pb-4 border-b border-[#E5E5E0]">
                  <span className="press-tag press-tag-crimson text-[9px]">
                    THE WEB3 DILEMMA
                  </span>
                  <h4 className="font-serif font-bold text-sm text-[#111827] leading-snug">
                    Why Paper NDAs Are Dead in the Agentic Economy
                  </h4>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    Pseudonymous auditors and AI agents operate beyond traditional legal borders.
                    No civil court can serve a subpoena to an anonymous Ethereum address.
                    Economic escrows on GenLayer substitute paper threats with cryptographic reality.
                  </p>
                </article>

                {/* Editorial Precedent 2 */}
                <article className="space-y-2 pb-4 border-b border-[#E5E5E0]">
                  <span className="press-tag press-tag-forest text-[9px]">
                    ARCHITECTURAL TRUTH
                  </span>
                  <h4 className="font-serif font-bold text-sm text-[#111827] leading-snug">
                    Solidity's Inability to Read the Web
                  </h4>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    Smart contracts on Ethereum cannot verify if an unreleased codebase or canary was
                    posted on Pastebin. GenLayer validators execute <code className="font-mono text-[10px] text-[#111827]">gl.nondet.web.render</code> directly
                    on-chain without relying on trusted oracle middlemen.
                  </p>
                </article>

                {/* Editorial Precedent 3 */}
                <article className="space-y-2">
                  <span className="press-tag press-tag-amber text-[9px]">
                    CONSENSUS ENGINE
                  </span>
                  <h4 className="font-serif font-bold text-sm text-[#111827] leading-snug">
                    Optimistic Democracy on Semantic Verdicts
                  </h4>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    Validators compare whether the breach verdict aligns (<code className="font-mono text-[10px] text-[#111827]">mine["verdict"] == leader["verdict"]</code>).
                    Different natural language explanations are permitted, ensuring subjective consensus on facts without rigid schema brittleness.
                  </p>
                </article>
              </div>
            </div>
          </div>
        )}

        {/* View Mode: Register New NDA */}
        {viewMode === 'register' && (
          <RegisterNDA
            contractAddress={contractAddress}
            account={account}
            onSuccess={() => {
              loadOnChainData();
              if (account) loadBalance(account);
              setViewMode('newspaper');
            }}
            onTxStart={(title, desc) => setTxPending({ title, desc })}
            onTxEnd={() => setTxPending(null)}
          />
        )}

        {/* View Mode: Whistleblower Portal */}
        {viewMode === 'whistleblower' && (
          <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 sm:p-8 space-y-6 shadow-xs">
            <div className="border-b border-[#E5E5E0] pb-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="press-tag press-tag-crimson text-[10px]">
                  WHISTLEBLOWER DISPATCH DESK
                </span>
              </div>
              <h2 className="font-serif font-bold text-2xl text-[#111827]">
                Submit Evidence of Confidential Leak
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] mt-1">
                Select from the list of monitored active escrow dockets to report unauthorized disclosure.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases
                .filter((c) => c.status === 0)
                .map((c) => (
                  <CaseCard
                    key={c.case_id}
                    caseItem={c}
                    account={account}
                    onReportLeak={(item) => setReportModalCase(item)}
                    onAdjudicateLeak={handleAdjudicate}
                    onCloseAndReclaim={handleCloseAndReclaim}
                    onViewJuryReport={(item) => setJuryModalCase(item)}
                    isActionPending={txPending !== null}
                  />
                ))}
            </div>

            {cases.filter((c) => c.status === 0).length === 0 && (
              <p className="text-xs text-[#6B7280] italic text-center py-10">
                No active dockets available for leak reporting at this time.
              </p>
            )}
          </div>
        )}

        {/* View Mode: Jurisprudence & Precedent */}
        {viewMode === 'archive' && (
          <div className="bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-8 space-y-6 shadow-xs max-w-4xl mx-auto">
            <div className="border-b border-[#E5E5E0] pb-4">
              <span className="press-tag press-tag-neutral text-[10px]">
                COMPENDIUM OF LAW & CODE
              </span>
              <h2 className="font-serif font-bold text-3xl text-[#111827] mt-1">
                The GenLayer Adjudication Standard
              </h2>
            </div>

            <div className="space-y-4 text-xs sm:text-sm text-[#374151] leading-relaxed font-serif">
              <p>
                AgentNDA operates on the principle that <strong>economic incentives and decentralized consensus</strong> can
                replace ambiguous jurisdictional courts. By locking collateral upfront, both the secret-holder and the recipient
                enter a verifiable compact.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-[#F9F8F6] border border-[#E5E5E0] rounded-lg">
                  <h4 className="font-serif font-bold text-sm text-[#111827] mb-1">
                    Decentralized Proof of Disclosure
                  </h4>
                  <p className="text-xs text-[#4B5563] font-sans">
                    Any public evidence URL (Pastebin, Twitter/X, GitHub Gist) can be rendered directly by GenVM nodes
                    without relying on API keys or centralized servers.
                  </p>
                </div>
                <div className="p-4 bg-[#F9F8F6] border border-[#E5E5E0] rounded-lg">
                  <h4 className="font-serif font-bold text-sm text-[#111827] mb-1">
                    Semantic Consensus Integrity
                  </h4>
                  <p className="text-xs text-[#4B5563] font-sans">
                    Rather than exact byte comparisons, the leader and validators agree on the verdict outcome:
                    whether the protected secret was exposed above the confidence threshold.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#E5E5E0] bg-[#FFFFFF] py-6 text-center text-xs text-[#6B7280]">
        <div className="max-w-7xl mx-auto px-4 space-y-1.5">
          <p className="font-serif font-bold text-[#111827]">
            THE AGENTIC ADJUDICATOR • AGENTNDA PRESS EDITION
          </p>
          <p className="font-mono text-[11px] text-[#4B5563]">
            Deployed on GenLayer Studionet (Chain ID: 61999) • Contract: {contractAddress}
          </p>
        </div>
      </footer>

      {/* Whistleblower Leak Report Modal */}
      {reportModalCase && (
        <ReportLeak
          caseData={reportModalCase}
          contractAddress={contractAddress}
          account={account}
          onClose={() => setReportModalCase(null)}
          onSuccess={() => {
            loadOnChainData();
            if (account) loadBalance(account);
          }}
          onTxStart={(title, desc) => setTxPending({ title, desc })}
          onTxEnd={() => setTxPending(null)}
        />
      )}

      {/* AI Jury Verdict Modal */}
      {juryModalCase && (
        <BreachJuryModal
          caseData={juryModalCase}
          onClose={() => setJuryModalCase(null)}
        />
      )}

      {/* Transaction Pending Modal */}
      {txPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-8 shadow-2xl text-center space-y-4">
            <Loader2 className="w-8 h-8 text-[#111827] animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="font-serif font-bold text-lg text-[#111827]">{txPending.title}</h3>
              <p className="text-xs text-[#4B5563] font-mono leading-relaxed">
                {txPending.desc}
              </p>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              GenLayer consensus takes ~10-25s for decentralized LLM inference.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
