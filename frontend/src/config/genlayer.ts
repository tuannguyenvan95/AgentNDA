import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { formatGen } from '../utils/helpers';

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_CHAIN_ID_HEX = '0xf22f'; // 61999 in hex is 0xF22F
export const STUDIONET_RPC_URL = 'https://studio.genlayer.com/api';
export const STUDIO_URL = 'https://studio.genlayer.com';

export const DEFAULT_CONTRACT_ADDRESS = '0x816c2421ae6B4Bf23bbA5f4e0b9320c97271290a';

// Persistent contract address handling
export function getSavedContractAddress(): string {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('agentnda_contract_address');
      if (stored && stored.trim().startsWith('0x')) {
        const clean = stored.trim();
        // Auto-upgrade if browser has old test contract cached
        if (clean.toLowerCase() === '0x125b6c27feb943a4b8bfa2e2499645229f3458f6') {
          localStorage.setItem('agentnda_contract_address', DEFAULT_CONTRACT_ADDRESS);
          return DEFAULT_CONTRACT_ADDRESS;
        }
        return clean;
      }
    } catch (e) {
      // ignore
    }
  }
  return DEFAULT_CONTRACT_ADDRESS;
}

export function saveContractAddress(address: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('agentnda_contract_address', address.trim());
  }
}

/**
 * Fetch real on-chain GEN balance directly from Studionet RPC endpoint
 */
export async function fetchStudionetBalance(address: string): Promise<string> {
  if (!address) return '0.00';

  // Priority 1: Direct RPC to Studionet node
  try {
    const res = await fetch(STUDIONET_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBalance',
        params: [address, 'latest'],
        id: Date.now(),
      }),
    });
    const json = await res.json();
    if (json && json.result !== undefined && json.result !== null) {
      return formatGen(json.result);
    }
  } catch (err) {
    console.warn('Direct Studionet RPC eth_getBalance error:', err);
  }

  // Priority 2: MetaMask provider if connected to Studionet
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const currentChainHex = await (window as any).ethereum.request({ method: 'eth_chainId' });
      const currentChainId = parseInt(currentChainHex, 16);
      if (currentChainId === STUDIONET_CHAIN_ID) {
        const balHex = await (window as any).ethereum.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });
        if (balHex) {
          return formatGen(balHex);
        }
      }
    } catch (e) {
      console.warn('MetaMask eth_getBalance error:', e);
    }
  }

  return '0.00';
}

export interface NDACaseData {
  case_id: string;
  issuer: string;
  whistleblower: string;
  bounty_amount: string;
  reporter_bond?: string;
  nda_scope: string;
  evidence_url: string;
  status: number; // 0: ACTIVE_SECURE, 1: IN_AUDIT, 2: BREACH_CONFIRMED, 3: SECURE_EXPIRED
  verdict: string; // "PENDING", "BREACH_CONFIRMED", "NO_BREACH", "FETCH_FAILED", "SECURE_EXPIRED"
  reason: string;
  confidence: number;
  leak_severity: number;
  created_at_timestamp?: string;
  expires_at_timestamp?: string;
  created_at_block?: string;
}

export interface ProtocolStats {
  total_cases: number;
  total_bounty_locked: string;
  total_breaches_settled: number;
}

/**
 * Get GenLayer client. If account and provider are passed, can sign write transactions.
 */
export function getGenLayerClient(accountAddress?: string) {
  const config: any = {
    chain: studionet,
    endpoint: STUDIONET_RPC_URL,
  };

  if (typeof window !== 'undefined' && (window as any).ethereum && accountAddress) {
    config.provider = (window as any).ethereum;
    config.account = accountAddress as `0x${string}`;
  }

  return createClient(config);
}

/**
 * Switch or add GenLayer Studionet chain in MetaMask (Chain ID: 61999 / 0xf22f)
 */
export async function ensureStudionet(): Promise<boolean> {
  if (typeof window === 'undefined' || !(window as any).ethereum) {
    throw new Error('MetaMask is not installed. Please install MetaMask to use AgentNDA.');
  }

  const ethereum = (window as any).ethereum;

  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: STUDIONET_CHAIN_ID_HEX }],
    });
    return true;
  } catch (switchError: any) {
    if (
      switchError.code === 4902 ||
      switchError?.data?.originalError?.code === 4902 ||
      switchError?.message?.includes('Unrecognized chain') ||
      switchError?.message?.includes('wallet_addEthereumChain')
    ) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: STUDIONET_CHAIN_ID_HEX,
              chainName: 'GenLayer Studionet',
              nativeCurrency: {
                name: 'GEN',
                symbol: 'GEN',
                decimals: 18,
              },
              rpcUrls: [STUDIONET_RPC_URL],
              blockExplorerUrls: ['https://genlayer-explorer.vercel.app'],
            },
          ],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Studionet chain to MetaMask:', addError);
        throw addError;
      }
    }
    console.error('Failed to switch to Studionet chain:', switchError);
    throw switchError;
  }
}

/**
 * Fetch aggregated protocol stats from contract
 */
export async function fetchStats(contractAddress: string): Promise<ProtocolStats> {
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return {
      total_cases: 0,
      total_bounty_locked: '0',
      total_breaches_settled: 0,
    };
  }

  try {
    const client = getGenLayerClient();
    const raw = await client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'get_stats',
      args: [],
    });

    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    return raw as unknown as ProtocolStats;
  } catch (err) {
    console.warn('fetchStats error:', err);
    return {
      total_cases: 0,
      total_bounty_locked: '0',
      total_breaches_settled: 0,
    };
  }
}

/**
 * Fetch all NDA cases registered in the contract
 */
export async function fetchAllCases(contractAddress: string): Promise<NDACaseData[]> {
  if (!contractAddress || contractAddress === '0x0000000000000000000000000000000000000000') {
    return [];
  }

  const client = getGenLayerClient();

  // Fast path: try get_all_cases() view
  try {
    const rawAll = await client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'get_all_cases',
      args: [],
    });
    if (rawAll) {
      const parsed: NDACaseData[] = typeof rawAll === 'string' ? JSON.parse(rawAll) : rawAll;
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    // Fallback to sequential index reads
  }

  // Fallback path: count + get_case_id_by_index + get_case
  try {
    const countRaw = await client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'get_case_count',
      args: [],
    });

    const count = Number(countRaw);
    if (isNaN(count) || count <= 0) return [];

    const cases: NDACaseData[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const caseId = (await client.readContract({
          address: contractAddress as `0x${string}`,
          functionName: 'get_case_id_by_index',
          args: [i],
        })) as string;

        if (caseId) {
          const rawCase = await client.readContract({
            address: contractAddress as `0x${string}`,
            functionName: 'get_case',
            args: [caseId],
          });

          const parsed: NDACaseData = typeof rawCase === 'string' ? JSON.parse(rawCase) : rawCase;
          cases.push(parsed);
        }
      } catch (err) {
        console.error(`Error reading case index ${i}:`, err);
      }
    }

    return cases;
  } catch (err) {
    console.warn('fetchAllCases error:', err);
    return [];
  }
}

/**
 * Fetch a single case by ID
 */
export async function fetchCase(contractAddress: string, caseId: string): Promise<NDACaseData | null> {
  try {
    const client = getGenLayerClient();
    const rawCase = await client.readContract({
      address: contractAddress as `0x${string}`,
      functionName: 'get_case',
      args: [caseId],
    });
    return typeof rawCase === 'string' ? JSON.parse(rawCase) : (rawCase as unknown as NDACaseData);
  } catch (e) {
    console.error(`Error loading case ${caseId}:`, e);
    return null;
  }
}

/**
 * Register NDA escrow and lock native GEN bounty
 */
export async function registerNdaEscrowOnChain(
  contractAddress: string,
  userAddress: string,
  ndaScope: string,
  bountyWei: bigint,
  durationSeconds: number = 604800
): Promise<string> {
  await ensureStudionet();
  const client = getGenLayerClient(userAddress);

  const txHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'register_nda_escrow',
    args: [ndaScope.trim(), durationSeconds],
    value: bountyWei,
  });

  await client.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Submit leak report with public evidence URL (Whistleblower) staking anti-spam bond
 */
export async function reportLeakOnChain(
  contractAddress: string,
  userAddress: string,
  caseId: string,
  evidenceUrl: string,
  bondWei: bigint = 0n
): Promise<string> {
  await ensureStudionet();
  const client = getGenLayerClient(userAddress);

  const txHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'report_leak',
    args: [caseId, evidenceUrl.trim()],
    value: bondWei,
  });

  await client.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Trigger on-chain AI Jury leak adjudication
 */
export async function adjudicateLeakOnChain(
  contractAddress: string,
  userAddress: string,
  caseId: string
): Promise<string> {
  await ensureStudionet();
  const client = getGenLayerClient(userAddress);

  const txHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'adjudicate_leak',
    args: [caseId],
    value: 0n,
  });

  await client.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}

/**
 * Reclaim escrowed funds upon term expiration without leaks (Issuer only)
 */
export async function closeAndReclaimOnChain(
  contractAddress: string,
  userAddress: string,
  caseId: string
): Promise<string> {
  await ensureStudionet();
  const client = getGenLayerClient(userAddress);

  const txHash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName: 'close_and_reclaim',
    args: [caseId],
    value: 0n,
  });

  await client.waitForTransactionReceipt({ hash: txHash });
  return txHash;
}
