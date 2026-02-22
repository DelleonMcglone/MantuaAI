export type QueryType = 'price' | 'volume' | 'comparison' | 'portfolio' | 'performance' | 'tvl' | 'action' | 'general' | 'addLiquidity' | 'liquidityList' | 'swap' | 'agent' | 'newChat' | 'faucet' | 'analysis' | 'balance';

export interface ClassifiedQuery {
  type: QueryType;
  assets: string[];
  timeRange: string;
  chartType: 'line' | 'bar' | 'pie' | 'area';
  hook?: string;
  params?: any;
}

// Normalize common token names to the testnet token symbols used in the app
const normalizeTokenSymbol = (sym: string): string => {
  const upper = sym.toUpperCase();
  const aliases: Record<string, string> = {
    'USDC':  'mUSDC',
    'USDT':  'mUSDT',
    'USDE':  'mUSDE',
    'USDS':  'mUSDS',
    'DAI':   'mUSDS', // mDAI has been renamed to mUSDS
    'BTC':   'mBTC',
    'WBTC':  'mWBTC',
    'SOL':   'mWSOL',
    'WETH':  'mWETH',
    'STETH': 'mstETH',
    'CBETH': 'mcbETH',
    'BUIDL': 'mBUIDL',
    'USDY':  'mUSDY',
    'WBTC':  'mWBTC',
  };
  return aliases[upper] ?? upper;
};

const extractPoolFromMessage = (msg: string) => {
  const poolMatch = msg.match(/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/);
  if (poolMatch) {
    const tokenA = normalizeTokenSymbol(poolMatch[1]);
    const tokenB = normalizeTokenSymbol(poolMatch[2]);
    return {
      pool: `${tokenA}/${tokenB}`,
      tokenA,
      tokenB,
    };
  }
  return null;
};

const extractSwapParams = (msg: string) => {
  const match = msg.match(/swap\s+(\d*\.?\d+)?\s*(\w+)?\s*(?:for|to|->|→)?\s*(\w+)?(?:\s+(?:using|with)\s+(.+))?/i);
  if (match) {
    return {
      fromAmount: match[1] || '',
      fromToken: match[2]?.toUpperCase() || '',
      toToken: match[3]?.toUpperCase() || '',
      hook: match[4]?.trim() || ''
    };
  }
  return null;
};

export const classifyQuery = (input: string): ClassifiedQuery => {
  const msg = input.toLowerCase().trim();
  
  const result: ClassifiedQuery = {
    type: 'general',
    assets: [],
    timeRange: '7d',
    chartType: 'line'
  };

  // ADD LIQUIDITY
  if (
    msg.match(/^add\s+(liquidity|lp)/) ||
    msg.match(/add\s+(liquidity|lp)\s+to/) ||
    msg.includes('add liquidity')
  ) {
    result.type = 'addLiquidity';
    result.params = extractPoolFromMessage(msg);
    return result;
  }
  
  // LIQUIDITY POOLS LIST
  if (
    msg === 'liquidity' ||
    msg.match(/^(show|view|open|display)\s*(liquidity|pools)/) ||
    msg.match(/liquidity\s*pools?$/) ||
    msg.match(/^pools?$/) ||
    msg === 'show pools' ||
    msg === 'view pools'
  ) {
    result.type = 'liquidityList';
    return result;
  }
  
  // SWAP
  if (
    msg.startsWith('swap') ||
    msg.match(/^(swap|exchange|trade)\s+\d*\.?\d*\s*\w+/)
  ) {
    result.type = 'swap';
    result.params = extractSwapParams(msg);
    return result;
  }
  
  // AGENT
  if (
    msg === 'agent' ||
    msg.match(/^(show|open|view)\s*agent/) ||
    msg.includes('agent builder') ||
    msg.includes('create an agent') || 
    msg.includes('build an agent')
  ) {
    result.type = 'agent';
    return result;
  }
  
  // NEW CHAT
  if (
    msg === 'new chat' ||
    msg === 'clear' ||
    msg === 'reset' ||
    msg.match(/^(start|begin)\s*(new|fresh)?\s*chat/)
  ) {
    result.type = 'newChat';
    return result;
  }
  
  // BALANCE
  if (
    msg.includes("what's my balance") ||
    msg.includes("what is my balance") ||
    msg.includes('my balance') ||
    msg.includes('how much do i have') ||
    msg.includes('check my balance') ||
    msg.includes('show my balance') ||
    msg.includes('check balance') ||
    msg === 'balance'
  ) {
    result.type = 'balance';
    return result;
  }

  // PORTFOLIO
  if (
    msg === 'portfolio' ||
    msg.match(/^(show|view|my)\s*portfolio/) ||
    msg.includes('show my positions') ||
    msg.includes('my positions') ||
    msg.includes('my liquidity') ||
    msg.includes('my lp') ||
    msg.includes('where is my liquidity') ||
    msg.includes('my active positions')
  ) {
    result.type = 'portfolio';
    return result;
  }
  
  // FAUCET
  if (
    msg === 'faucet' ||
    msg.match(/^(get|request)\s*(test)?\s*tokens?/) ||
    msg.includes('testnet tokens')
  ) {
    result.type = 'faucet';
    return result;
  }
  
  // ANALYSIS/RESEARCH
  if (
    msg.match(/(price|volume|tvl|apy)\s*(of|for)?/) ||
    msg.match(/^(what|how|show|compare)/)
  ) {
    if (msg.includes('price') || msg.includes('cost') || msg.includes('worth') || msg.includes('trading at')) {
      result.type = 'price';
      result.chartType = 'line';
    } else if (msg.includes('volume') || msg.includes('traded') || msg.includes('transactions') || msg.includes('activity')) {
      result.type = 'volume';
      result.chartType = 'bar';
    } else if (msg.includes('compare') || msg.includes('vs') || msg.includes('versus') || msg.includes('difference') || msg.includes('better')) {
      result.type = 'comparison';
      result.chartType = 'bar';
    } else if (msg.includes('portfolio') || msg.includes('holdings') || msg.includes('breakdown') || msg.includes('allocation')) {
      result.type = 'portfolio';
      result.chartType = 'pie';
    } else if (msg.includes('performance') || msg.includes('profit') || msg.includes('loss') || msg.includes('pnl') || msg.includes('return')) {
      result.type = 'performance';
      result.chartType = 'area';
    } else if (msg.includes('tvl') || msg.includes('liquidity') || msg.includes('locked')) {
      result.type = 'tvl';
      result.chartType = 'area';
    } else {
      result.type = 'price';
    }
  } else {
    result.type = 'general';
  }

  // Detect Assets
  const assetsMap: Record<string, string> = {
    'eth': 'ETH', 'ethereum': 'ETH',
    'btc': 'mBTC', 'bitcoin': 'mBTC',
    'usdc': 'mUSDC', 'musdc': 'mUSDC',
    'usdt': 'mUSDT', 'musdt': 'mUSDT',
    'usds': 'mUSDS', 'musds': 'mUSDS',
    'usde': 'mUSDE', 'musde': 'mUSDE',
    'wbtc': 'mWBTC', 'mwbtc': 'mWBTC',
    'weth': 'mWETH', 'mweth': 'mWETH',
    'wsol': 'mWSOL', 'mwsol': 'mWSOL',
  };

  for (const [key, value] of Object.entries(assetsMap)) {
    if (msg.includes(key)) {
      if (!result.assets.includes(value)) {
        result.assets.push(value);
      }
    }
  }

  // Detect Time Range
  if (msg.includes('yesterday') || msg.includes('24h') || msg.includes('24 hours') || msg.includes('today')) {
    result.timeRange = '24h';
  } else if (msg.includes('week') || msg.includes('7d') || msg.includes('7 days')) {
    result.timeRange = '7d';
  } else if (msg.includes('month') || msg.includes('30d') || msg.includes('30 days')) {
    result.timeRange = '30d';
  } else if (msg.includes('year') || msg.includes('1y')) {
    result.timeRange = '1y';
  }

  // Detect Hooks
  if (msg.includes('no hook')) result.hook = 'None';

  return result;
};
