import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  PlusCircle,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Search,
  Loader2,
  Cpu,
  Globe,
  AlertTriangle,
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

  // UI Navigation & Filters
  const [activeTab, setActiveTab] = useState<'cases' | 'register' | 'whistleblower' | 'about'>('cases');
  const [filter, setFilter] = useState<'all' | 'active' | 'audit' | 'settled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Action Status
  const [reportModalCase, setReportModalCase] = useState<NDACaseData | null>(null);
  const [juryModalCase, setJuryModalCase] = useState<NDACaseData | null>(null);
  const [txPending, setTxPending] = useState<{ title: string; desc: string } | null>(null);

  // Auto-fetch state from on-chain contract
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
      // Fetch updated case and show jury report
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

  // Listen for MetaMask events (account change, chain change)
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

      // Check current accounts on mount
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

  // Periodic polling on-chain state
  useEffect(() => {
    loadOnChainData();
    const interval = setInterval(loadOnChainData, 10000);
    return () => clearInterval(interval);
  }, [loadOnChainData]);

  // Filtered cases
  const filteredCases = cases.filter((c) => {
    // Search query filter
    const matchesQuery =
      c.case_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.nda_scope.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.issuer.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesQuery) return false;

    // Status filter
    if (filter === 'active') return c.status === 0;
    if (filter === 'audit') return c.status === 1;
    if (filter === 'settled') return c.status === 2 || c.status === 3;
    return true;
  });

  const activeCasesCount = cases.filter((c) => c.status === 0).length;

  return (
    <div className="min-h-screen bg-[#0a0d14] text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
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

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Hero Banner */}
        <div className="relative rounded-3xl p-6 sm:p-10 overflow-hidden bg-gradient-to-r from-indigo-950/50 via-[#121722] to-cyan-950/40 border border-white/10 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-semibold text-indigo-300">
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              <span>Subjective Consensus & AI Governance Protocol</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
              Autonomous Web3 Leak Adjudication & Whistleblower Bounty Escrow
            </h1>
            <p className="text-xs sm:text-base text-slate-300 leading-relaxed">
              Traditional paper NDAs fail in anonymous Web3 environments. AgentNDA replaces legal
              jurisdiction with an <strong>autonomous on-chain court</strong>: validators read public leak
              evidence live from the web, adjudicate material disclosure via LLM consensus, and
              instantaneously settle bounties to whistleblowers.
            </p>

            {/* Quick CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('register')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/25 flex items-center gap-2 transition"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Create NDA Escrow</span>
              </button>
              <button
                onClick={() => setActiveTab('whistleblower')}
                className="px-5 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs sm:text-sm font-bold flex items-center gap-2 transition"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Report a Leak</span>
              </button>
              <button
                onClick={() => setActiveTab('about')}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold transition"
              >
                How It Works
              </button>
            </div>
          </div>
        </div>

        {/* Aggregated Protocol Metrics Bar */}
        <StatsBar stats={stats} activeCount={activeCasesCount} />

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2 p-1 bg-black/40 border border-white/10 rounded-2xl">
            <button
              onClick={() => setActiveTab('cases')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'cases'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>All NDA Escrows</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10 text-slate-300">
                {cases.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('register')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'register'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Register NDA Escrow</span>
            </button>

            <button
              onClick={() => setActiveTab('whistleblower')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'whistleblower'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                  : 'text-slate-400 hover:text-rose-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Whistleblower Portal</span>
            </button>

            <button
              onClick={() => setActiveTab('about')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'about'
                  ? 'bg-white/10 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Architecture & Rules</span>
            </button>
          </div>

          {/* Refresh State Button */}
          <button
            onClick={loadOnChainData}
            disabled={isLoadingCases}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
            title="Refresh on-chain state"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCases ? 'animate-spin text-indigo-400' : ''}`} />
            <span className="hidden sm:inline">Sync On-Chain</span>
          </button>
        </div>

        {/* Tab 1: All Cases View */}
        {activeTab === 'cases' && (
          <div className="space-y-6">
            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Case ID, Canary keywords, or Issuer..."
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {(['all', 'active', 'audit', 'settled'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                      filter === f
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'text-slate-400 hover:text-white bg-transparent'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Cases Grid */}
            {isLoadingCases && cases.length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto" />
                <p className="text-sm text-slate-300 font-medium">Hydrating NDA Escrows from GenLayer Studionet...</p>
                <p className="text-xs text-slate-500 font-mono">Target: {contractAddress}</p>
              </div>
            ) : filteredCases.length === 0 ? (
              <div className="glass-panel rounded-3xl p-16 text-center space-y-4">
                <Shield className="w-12 h-12 text-slate-600 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">No NDA Escrows Found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {searchQuery
                      ? 'No cases match your search query.'
                      : 'There are currently no NDA escrow cases on this contract address. Register the first case!'}
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('register')}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Create First NDA Escrow</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
        )}

        {/* Tab 2: Register New NDA */}
        {activeTab === 'register' && (
          <RegisterNDA
            contractAddress={contractAddress}
            account={account}
            onSuccess={() => {
              loadOnChainData();
              if (account) loadBalance(account);
              setActiveTab('cases');
            }}
            onTxStart={(title, desc) => setTxPending({ title, desc })}
            onTxEnd={() => setTxPending(null)}
          />
        )}

        {/* Tab 3: Whistleblower Portal */}
        {activeTab === 'whistleblower' && (
          <div className="space-y-6">
            <div className="p-6 rounded-3xl bg-gradient-to-r from-rose-950/40 to-[#121722] border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>Whistleblower Bounty Portal</span>
              </div>
              <h2 className="text-xl font-black text-white">
                Earn On-Chain Rewards For Proven Information Leaks
              </h2>
              <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                Organizations lock GEN bounties to ensure their trade secrets remain confidential.
                If you discover a leak on Twitter/X, Pastebin, technical blogs, or forums, submit the URL.
                GenLayer's AI Jury will autonomously crawl the link, compare it with protected canaries,
                and immediately award 100% of the locked bounty upon consensus confirmation.
              </p>
            </div>

            {/* List of Active cases ready for leak reporting */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                Active Protected Contracts (Ready for Leak Submission):
              </h3>
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
                <div className="p-8 text-center text-xs text-slate-500 glass-panel rounded-2xl">
                  No active NDAs currently waiting for leak monitoring.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Architecture & Rules Guide */}
        {activeTab === 'about' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="glass-panel rounded-3xl p-8 space-y-6 border border-white/10">
              <div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  The GenLayer Unique Hook
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  Why AgentNDA Dies Without GenLayer
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                {/* Traditional / Solidity */}
                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Traditional Web3 & Solidity Fails</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-2 list-disc list-inside leading-relaxed">
                    <li>
                      <strong>Paper NDAs are useless in Web3:</strong> Anonymous developers, sub-agents,
                      and auditor hackers cannot be hauled into municipal courts.
                    </li>
                    <li>
                      <strong>Solidity is blind to the web:</strong> Smart contracts on Ethereum cannot
                      read Twitter, Pastebin, or news blogs without centralized, trusted oracles.
                    </li>
                    <li>
                      <strong>No subjective understanding:</strong> Solidity cannot semantically assess
                      whether a leaked snippet matches a protected trade secret or is just a rumor.
                    </li>
                  </ul>
                </div>

                {/* GenLayer Solution */}
                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Cpu className="w-4 h-4" />
                    <span>AgentNDA on GenLayer Studionet</span>
                  </div>
                  <ul className="text-xs text-slate-200 space-y-2 list-disc list-inside leading-relaxed">
                    <li>
                      <strong>Live Web Access on-chain:</strong> Validators invoke <code>gl.nondet.web.render</code> directly
                      to extract public evidence content without any middleman oracle.
                    </li>
                    <li>
                      <strong>Semantic Consensus:</strong> Multiple validator LLMs evaluate disclosure
                      severity against protected canaries and agree on the <code>VERDICT</code> via <code>gl.vm.run_nondet</code>.
                    </li>
                    <li>
                      <strong>Autonomous Payout:</strong> Whistleblower receives instant native GEN reward
                      directly from contract via <code>emit_transfer</code>.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Consensus Lifecycle Diagram */}
              <div className="pt-4 border-t border-white/5 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>The 4-Step Autonomous Adjudication Lifecycle</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="font-mono text-indigo-400 font-bold">01. Escrow</span>
                    <p className="text-[11px] text-slate-400">Issuer locks GEN bounty & specifies confidential scope and canaries.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="font-mono text-rose-400 font-bold">02. Report</span>
                    <p className="text-[11px] text-slate-400">Whistleblower submits live URL where secrets were allegedly exposed.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="font-mono text-cyan-400 font-bold">03. Jury Adjudication</span>
                    <p className="text-[11px] text-slate-400">Validators scrape URL & compare content via LLM Optimistic Democracy.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1">
                    <span className="font-mono text-emerald-400 font-bold">04. Instant Settle</span>
                    <p className="text-[11px] text-slate-400">BREACH_CONFIRMED transfers bounty to whistleblower; false reports reset to active.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>
            AgentNDA — Autonomous Web3 Leak Adjudication & Whistleblower Bounty Escrow on{' '}
            <a
              href="https://studio.genlayer.com"
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 underline hover:text-indigo-300"
            >
              GenLayer Studionet (Chain ID: 61999)
            </a>
          </p>
          <p className="font-mono text-[11px]">
            Contract: {contractAddress}
          </p>
        </div>
      </footer>

      {/* Report Leak Modal */}
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

      {/* Breach Jury Report Modal */}
      {juryModalCase && (
        <BreachJuryModal
          caseData={juryModalCase}
          onClose={() => setJuryModalCase(null)}
        />
      )}

      {/* Transaction Pending Consensus Overlay */}
      {txPending && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#121722] border border-indigo-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-5">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="w-full h-full rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <Cpu className="w-7 h-7 text-cyan-400 absolute" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black text-white">{txPending.title}</h3>
              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                {txPending.desc}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Consensus Engine:</span>
                <span className="text-indigo-400 font-bold">Optimistic Democracy</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Target Network:</span>
                <span className="text-cyan-400 font-bold">Studionet (61999)</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              Non-deterministic transactions involve decentralized LLM inference and may take ~10-25 seconds to finalize.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
