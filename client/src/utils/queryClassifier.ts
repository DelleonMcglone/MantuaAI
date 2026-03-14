export type QueryType = 'price' | 'volume' | 'comparison' | 'portfolio' | 'performance' | 'tvl' | 'action' | 'general' | 'addLiquidity' | 'liquidityList' | 'swap' | 'agent' | 'newChat' | 'faucet' | 'analysis' | 'balance';

export interface ClassifiedQuery {
  type: QueryType;
  assets: string[];
  timeRange: string;
  chartType: 'line' | 'bar' | 'pie' | 'area';
  hook?: string;
  params?: any;
}

const VALID_TOKENS = new Set(['ETH', 'CBBTC', 'USDC', 'EURC']);

const normalizeTokenSymbol = (sym: string): string => {
  const upper = sym.toUpperCase();
  // Normalize common aliases to our supported tokens
  if (upper === 'CBBTC' || upper === 'BTC' || upper === 'WBTC') return 'cbBTC';
  if (upper === 'ETH' || upper === 'WETH') return 'ETH';
  if (upper === 'USDC' || upper === 'USD') return 'USDC';
  if (upper === 'EURC' || upper === 'EUR') return 'EURC';
  if (upper === 'TUSDT' || upper === 'USDT' || upper === 'TETHER') return 'tUSDT';
  if (upper === 'LINK' || upper === 'CHAINLINK') return 'LINK';
  return upper;
};

const extractHookFromMessage = (msg: string): string => {
  const hookMatch = msg.match(/(?:with|using)\s+(stable\s*protection|limit\s*order|twamm|dynamic\s*fee|no\s*hook)/i);
  if (hookMatch) return hookMatch[1].trim();
  return '';
};

const KNOWN_TOKENS_LOWER = ['eth', 'usdc', 'eurc', 'cbbtc', 'btc', 'wbtc', 'weth', 'usd', 'eur', 'tusdt', 'usdt', 'link'];

const extractPoolFromMessage = (msg: string) => {
  const poolMatch = msg.match(/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)/);
  if (poolMatch) {
    const tokenA = normalizeTokenSymbol(poolMatch[1]);
    const tokenB = normalizeTokenSymbol(poolMatch[2]);
    return {
      pool: `${tokenA}/${tokenB}`,
      tokenA,
      tokenB,
      hook: extractHookFromMessage(msg),
    };
  }

  const amountTokenPattern = /\$?\d+\.?\d*\s*([a-zA-Z]+)/g;
  const amountTokens: string[] = [];
  let m;
  while ((m = amountTokenPattern.exec(msg)) !== null) {
    const sym = m[1].toLowerCase();
    if (KNOWN_TOKENS_LOWER.includes(sym)) amountTokens.push(normalizeTokenSymbol(m[1]));
  }
  if (amountTokens.length >= 2) {
    return {
      pool: `${amountTokens[0]}/${amountTokens[1]}`,
      tokenA: amountTokens[0],
      tokenB: amountTokens[1],
      hook: extractHookFromMessage(msg),
    };
  }

  const words = msg.replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/);
  const foundTokens: string[] = [];
  for (const w of words) {
    if (KNOWN_TOKENS_LOWER.includes(w.toLowerCase()) && foundTokens.length < 2) {
      const normalized = normalizeTokenSymbol(w);
      if (!foundTokens.includes(normalized)) foundTokens.push(normalized);
    }
  }
  if (foundTokens.length >= 2) {
    return {
      pool: `${foundTokens[0]}/${foundTokens[1]}`,
      tokenA: foundTokens[0],
      tokenB: foundTokens[1],
      hook: extractHookFromMessage(msg),
    };
  }

  return null;
};

const extractSwapParams = (msg: string) => {
  const match = msg.match(/swap\s+(\d*\.?\d+)?\s*(\w+)?\s*(?:for|to|->|→)?\s*(\w+)?(?:\s+(?:using|with|from(?:\s+the)?)\s+(.+?))?(?:\s+pool)?$/i);
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

  if (
    msg.match(/^add\s+(liquidity|lp)/) ||
    msg.match(/add\s+(liquidity|lp)\s+to/) ||
    msg.includes('add liquidity')
  ) {
    result.type = 'addLiquidity';
    result.params = extractPoolFromMessage(msg);
    return result;
  }
  
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
  
  if (
    msg.startsWith('swap') ||
    msg.match(/^(swap|exchange|trade)\s+\d*\.?\d*\s*\w+/)
  ) {
    result.type = 'swap';
    result.params = extractSwapParams(msg);
    return result;
  }
  
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
  
  if (
    msg === 'new chat' ||
    msg === 'clear' ||
    msg === 'reset' ||
    msg.match(/^(start|begin)\s*(new|fresh)?\s*chat/)
  ) {
    result.type = 'newChat';
    return result;
  }
  
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
  
  if (
    msg === 'faucet' ||
    msg.match(/^(get|request)\s*(test)?\s*tokens?/) ||
    msg.includes('testnet tokens') ||
    msg.includes('testnet funds') ||
    msg.includes('test tokens') ||
    msg.includes('get tokens') ||
    msg.includes('get funds') ||
    msg.includes('get eth') ||
    msg.includes('free tokens') ||
    msg.includes('free eth') ||
    msg.match(/where\s+(?:can|do)\s+(?:i|we)\s+get\s+(?:testnet\s+)?(?:tokens|funds|eth)/) ||
    msg.match(/how\s+(?:can|do|to)\s+(?:i|we)\s+get\s+(?:testnet\s+)?(?:tokens|funds|eth)/) ||
    msg.match(/(?:need|want)\s+(?:testnet\s+)?(?:tokens|funds|eth)/) ||
    msg.match(/claim\s+(?:testnet\s+)?(?:tokens|funds|eth)/) ||
    msg.match(/(?:where|how)\s+.*faucet/) ||
    msg.match(/fund\s+(?:my\s+)?wallet/) ||
    msg.match(/(?:get|claim|request)\s+(?:some\s+)?(?:usdc|eurc|link|cbbtc|tusdt|eth)/)
  ) {
    result.type = 'faucet';
    return result;
  }
  
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

  const assetsMap: Record<string, string> = {
    'eth': 'ETH', 'ethereum': 'ETH',
    'usdc': 'USDC',
    'eurc': 'EURC', 'euro': 'EURC',
    'cbbtc': 'cbBTC', 'btc': 'cbBTC', 'bitcoin': 'cbBTC',
    'tusdt': 'tUSDT', 'usdt': 'tUSDT', 'tether': 'tUSDT',
    'link': 'LINK', 'chainlink': 'LINK',
  };

  for (const [key, value] of Object.entries(assetsMap)) {
    if (msg.includes(key)) {
      if (!result.assets.includes(value)) {
        result.assets.push(value);
      }
    }
  }

  if (msg.includes('yesterday') || msg.includes('24h') || msg.includes('24 hours') || msg.includes('today')) {
    result.timeRange = '24h';
  } else if (msg.includes('week') || msg.includes('7d') || msg.includes('7 days')) {
    result.timeRange = '7d';
  } else if (msg.includes('month') || msg.includes('30d') || msg.includes('30 days')) {
    result.timeRange = '30d';
  } else if (msg.includes('year') || msg.includes('1y')) {
    result.timeRange = '1y';
  }

  if (msg.includes('no hook')) result.hook = 'None';

  return result;
};
