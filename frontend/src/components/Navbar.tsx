import React, { useState } from 'react';
import {
  Shield,
  Wallet,
  ExternalLink,
  Settings,
  HelpCircle,
  AlertCircle,
  Copy,
  Check,
  Scale,
} from 'lucide-react';
import { STUDIONET_CHAIN_ID, STUDIONET_RPC_URL, STUDIO_URL } from '../config/genlayer';
import { formatAddress } from '../utils/helpers';

interface NavbarProps {
  account: string | null;
  balance: string;
  isConnecting: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  contractAddress: string;
  onUpdateContractAddress: (addr: string) => void;
  chainId: number | null;
  onSwitchNetwork: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  account,
  balance,
  isConnecting,
  onConnectWallet,
  onDisconnectWallet,
  contractAddress,
  onUpdateContractAddress,
  chainId,
  onSwitchNetwork,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const [customAddress, setCustomAddress] = useState(contractAddress);
  const [copied, setCopied] = useState(false);

  const isStudionet = chainId === STUDIONET_CHAIN_ID;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveContract = () => {
    if (customAddress.trim().startsWith('0x') && customAddress.trim().length === 42) {
      onUpdateContractAddress(customAddress.trim());
      setShowSettings(false);
    }
  };

  return (
    <>
      <header className="w-full bg-[#FFFFFF] border-b border-[#E5E5E0]">
        {/* Top Masthead Line / Digital Press Dateline */}
        <div className="border-b border-[#E5E5E0] bg-[#F5F4F0] text-[11px] text-[#4B5563] font-mono tracking-wider py-1.5 px-4 sm:px-8 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#111827]">THE AGENTIC CHRONICLE</span>
            <span className="text-[#9CA3AF]">|</span>
            <span>VOL. VI • DISPATCH NO. 14</span>
            <span className="text-[#9CA3AF]">|</span>
            <span>GENLAYER STUDIONET (CHAIN ID: 61999)</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] uppercase font-semibold">
            <span className="flex items-center gap-1.5 text-[#15803D]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
              CONSENSUS: OPTIMISTIC DEMOCRACY
            </span>
            <span className="text-[#9CA3AF]">|</span>
            <span className="text-[#B91C1C]">UNBIASED WEB JURY</span>
          </div>
        </div>

        {/* Main Press Masthead */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Logo & Headline Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-[#111827] text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <Scale className="w-6 h-6 text-[#F9F8F6]" />
            </div>
            <div>
              <div className="flex items-baseline gap-2.5">
                <h1 className="font-serif font-black text-2xl sm:text-3xl tracking-tight text-[#111827]">
                  Agent<span className="text-[#B91C1C]">NDA</span>
                </h1>
                <span className="press-tag press-tag-neutral text-[10px]">
                  PRESS ESCROW GAZETTE
                </span>
              </div>
              <p className="text-xs text-[#6B7280] font-sans">
                Autonomous Web3 Leak Adjudication & Whistleblower Bounty Registry
              </p>
            </div>
          </div>

          {/* Controls & Wallet */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Network Indicator */}
            {isStudionet ? (
              <span className="press-tag press-tag-forest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#15803D]" />
                Studionet
              </span>
            ) : (
              <button
                onClick={onSwitchNetwork}
                className="press-tag press-tag-amber hover:opacity-80 transition cursor-pointer"
              >
                <AlertCircle className="w-3 h-3 text-[#B45309]" />
                Switch to Studionet
              </button>
            )}

            {/* GEN Faucet Memo */}
            <button
              onClick={() => setShowFaucetModal(true)}
              className="px-3 py-1.5 rounded-md bg-[#F9F8F6] border border-[#E5E5E0] hover:bg-[#F3F4F6] text-xs font-medium text-[#374151] flex items-center gap-1.5 transition"
              title="How to get GEN tokens on Studionet"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#111827]" />
              <span>Get GEN</span>
            </button>

            {/* Contract Configuration */}
            <button
              onClick={() => {
                setCustomAddress(contractAddress);
                setShowSettings(true);
              }}
              className="px-3 py-1.5 rounded-md bg-[#F9F8F6] border border-[#E5E5E0] hover:bg-[#F3F4F6] text-xs font-mono text-[#374151] flex items-center gap-1.5 transition"
              title="Contract Address"
            >
              <Settings className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>{formatAddress(contractAddress)}</span>
            </button>

            {/* MetaMask Wallet Connection */}
            {account ? (
              <div className="flex items-center gap-2 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md p-1 pl-2.5">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-[#111827] font-mono">{balance} GEN</span>
                  <span className="text-[10px] text-[#6B7280] font-mono">{formatAddress(account)}</span>
                </div>
                <button
                  onClick={onDisconnectWallet}
                  className="px-2 py-1 bg-[#FFFFFF] hover:bg-[#F3F4F6] border border-[#E5E5E0] rounded text-[11px] font-medium text-[#374151] transition"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                disabled={isConnecting}
                className="px-4 py-2 rounded-md bg-[#111827] hover:bg-[#1F2937] text-white text-xs font-bold tracking-wide uppercase shadow-sm flex items-center gap-2 transition disabled:opacity-50"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isConnecting ? 'Connecting...' : 'Connect MetaMask'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Network Warning Banner if connected to wrong chain */}
      {account && !isStudionet && (
        <div className="bg-[#FFFBEB] border-b border-[#FCD34D] px-4 py-2 text-center text-xs text-[#B45309] font-medium flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>MetaMask is currently on Chain ID {chainId || 'Unknown'}. AgentNDA requires GenLayer Studionet (61999).</span>
          <button
            onClick={onSwitchNetwork}
            className="underline font-bold hover:text-[#78350F] ml-2"
          >
            Switch to Studionet
          </button>
        </div>
      )}

      {/* Contract Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E0] pb-3">
              <h3 className="font-serif font-bold text-base text-[#111827] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#111827]" />
                Intelligent Contract Address
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-[#6B7280] hover:text-[#111827] text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#4B5563] leading-relaxed">
              Target Intelligent Contract deployed on GenLayer Studionet. Update this address to point your dApp instance to your own deployed contract.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#374151]">Contract Address (0x...)</label>
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md text-xs font-mono text-[#111827] focus:outline-none focus:border-[#111827]"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-3 py-1.5 rounded-md bg-[#F3F4F6] hover:bg-[#E5E5E0] text-xs font-medium text-[#374151] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContract}
                className="px-4 py-1.5 rounded-md bg-[#111827] hover:bg-[#1F2937] text-xs font-semibold text-white transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faucet Guidance Modal */}
      {showFaucetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E5E5E0] rounded-xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E5E0] pb-3">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#B91C1C]" />
                <h3 className="font-serif font-bold text-lg text-[#111827]">Studionet GEN Funding Dispatch</h3>
              </div>
              <button
                onClick={() => setShowFaucetModal(false)}
                className="text-[#6B7280] hover:text-[#111827] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#374151] leading-relaxed">
              <div className="p-3 rounded-md bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B]">
                <strong>Rule D1 Reminder:</strong> AgentNDA operates on <strong>GenLayer Studionet</strong>. The public testnet faucet does not fund Studionet accounts.
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-[#111827]">How to fund your MetaMask address:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-[#4B5563]">
                  <li>
                    Open{' '}
                    <a
                      href={STUDIO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#B91C1C] underline font-medium inline-flex items-center gap-1"
                    >
                      GenLayer Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Click on the <strong>Accounts</strong> tab in the sidebar.</li>
                  <li>Choose any pre-funded Studio account with high GEN balance.</li>
                  <li>Transfer <strong>10 to 50 GEN</strong> to your MetaMask address:</li>
                </ol>
              </div>

              {account && (
                <div className="p-2.5 bg-[#F9F8F6] border border-[#E5E5E0] rounded-md flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#111827] truncate">
                    {account}
                  </span>
                  <button
                    onClick={() => handleCopy(account)}
                    className="p-1 rounded bg-[#FFFFFF] border border-[#E5E5E0] text-[#374151] hover:bg-[#F3F4F6] text-[10px] flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#15803D]" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}

              <div className="text-[11px] text-[#6B7280] pt-1">
                RPC: <code className="font-mono text-[#111827]">{STUDIONET_RPC_URL}</code> • Chain ID: <code className="font-mono text-[#111827]">61999</code>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFaucetModal(false)}
                className="px-4 py-2 rounded-md bg-[#111827] hover:bg-[#1F2937] text-xs font-bold text-white transition"
              >
                Close Dispatch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
