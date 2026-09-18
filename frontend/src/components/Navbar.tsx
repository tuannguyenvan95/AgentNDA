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
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-[#0a0d14]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Brand Logo & Tag */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#0a0d14] rounded-[10px] flex items-center justify-center">
                <Shield className="w-6 h-6 text-indigo-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-indigo-200">
                  Agent<span className="text-indigo-400">NDA</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  STUDIONET
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Autonomous Web3 Leak Adjudication & Whistleblower Bounty Escrow
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-3">
            {/* Network Badge */}
            <div className="hidden md:flex items-center">
              {isStudionet ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Studionet (61999)</span>
                </div>
              ) : (
                <button
                  onClick={onSwitchNetwork}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Switch to Studionet</span>
                </button>
              )}
            </div>

            {/* Faucet / Accounts Helper */}
            <button
              onClick={() => setShowFaucetModal(true)}
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
              title="How to get GEN on Studionet"
            >
              <HelpCircle className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Get GEN</span>
            </button>

            {/* Contract Config Settings */}
            <button
              onClick={() => {
                setCustomAddress(contractAddress);
                setShowSettings(true);
              }}
              className="p-2 sm:px-3 sm:py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition"
              title="Contract Settings"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="hidden lg:inline font-mono">{formatAddress(contractAddress)}</span>
            </button>

            {/* MetaMask Wallet Connection */}
            {account ? (
              <div className="flex items-center gap-2 bg-[#121722] border border-white/10 rounded-xl p-1.5 pl-3">
                <div className="flex flex-col text-right">
                  <span className="text-xs font-bold text-white font-mono">{balance} GEN</span>
                  <span className="text-[10px] text-slate-400 font-mono">{formatAddress(account)}</span>
                </div>
                <button
                  onClick={onDisconnectWallet}
                  className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-slate-300 transition"
                  title="Disconnect"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                onClick={onConnectWallet}
                disabled={isConnecting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-indigo-500/25 transition disabled:opacity-50"
              >
                <Wallet className="w-4 h-4" />
                <span>{isConnecting ? 'Connecting...' : 'Connect MetaMask'}</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Network Warning Banner if connected to wrong chain */}
      {account && !isStudionet && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-center text-xs text-amber-300 flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>MetaMask is currently on Chain ID {chainId || 'Unknown'}. AgentNDA requires GenLayer Studionet (61999).</span>
          <button
            onClick={onSwitchNetwork}
            className="underline font-bold hover:text-white ml-2"
          >
            Switch Network Now
          </button>
        </div>
      )}

      {/* Contract Address Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#121722] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-400" />
                Intelligent Contract Address
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Target Intelligent Contract deployed on GenLayer Studionet. You can update this address if you deploy your own contract instance from GenLayer Studio.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400">Contract Address (0x...)</label>
              <input
                type="text"
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="0x..."
                className="w-full px-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-medium text-slate-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveContract}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Save Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Faucet & Account Funding Helper Modal */}
      {showFaucetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[#121722] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">How to Get GEN on Studionet</h3>
              </div>
              <button
                onClick={() => setShowFaucetModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-200">
                <strong>Important Rule (D1):</strong> AgentNDA is deployed on <strong>GenLayer Studionet</strong>. The public testnet faucet (testnet-faucet) does <em>NOT</em> fund Studionet accounts.
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-white">Steps to fund your MetaMask wallet:</p>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-slate-300">
                  <li>
                    Open{' '}
                    <a
                      href={STUDIO_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-1"
                    >
                      GenLayer Studio <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Click on the <strong>Accounts</strong> panel in the left sidebar.</li>
                  <li>Studio provides pre-funded accounts with plenty of GEN.</li>
                  <li>
                    Transfer <strong>10 to 50 GEN</strong> from the Studio account directly to your MetaMask address:
                  </li>
                </ol>
              </div>

              {account && (
                <div className="p-3 bg-black/40 border border-white/10 rounded-xl flex items-center justify-between gap-2">
                  <div className="truncate font-mono text-[11px] text-slate-300">
                    Your Address: <span className="text-white font-bold">{account}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(account)}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-[10px]">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              )}

              <div className="pt-2 text-[11px] text-slate-400">
                RPC Endpoint: <code className="text-cyan-300 font-mono">{STUDIONET_RPC_URL}</code>
                <br />
                Chain ID: <code className="text-cyan-300 font-mono">{STUDIONET_CHAIN_ID}</code> (hex: 0xF22F)
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowFaucetModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
