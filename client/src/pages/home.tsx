// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Moon, Sun, ChevronDown, Zap, Bot, Shield, Coins, BarChart3, Lock } from 'lucide-react';
import logoWhite from '@assets/Mantua_logo_white_1768946648374.png';
import logoBlack from '@assets/Mantua_logo_black_1768946648374.png';

const LOGO_WHITE = logoWhite;
const LOGO_BLACK = logoBlack;

const themes = {
  dark: {
    bgPrimary: '#08080c',
    bgSecondary: '#0f0f14',
    bgCard: 'rgba(255,255,255,0.03)',
    bgCardHover: 'rgba(255,255,255,0.06)',
    textPrimary: '#f0f0f5',
    textSecondary: '#8b8b9e',
    textMuted: '#5a5a6e',
    border: 'rgba(255,255,255,0.08)',
    borderHover: 'rgba(255,255,255,0.15)',
    accent: '#a855f7',
    accentGreen: '#22c55e',
  },
  light: {
    bgPrimary: '#fafafa',
    bgSecondary: '#ffffff',
    bgCard: 'rgba(0,0,0,0.02)',
    bgCardHover: 'rgba(0,0,0,0.05)',
    textPrimary: '#1a1a2e',
    textSecondary: '#5a5a6e',
    textMuted: '#8b8b9e',
    border: 'rgba(0,0,0,0.08)',
    borderHover: 'rgba(0,0,0,0.15)',
    accent: '#9333ea',
    accentGreen: '#16a34a',
  }
};

const FEATURES = [
  { icon: Shield, title: 'Stable Protection Hook', description: 'A Uniswap v4 hook that dynamically adjusts swap fees across five depeg zones to protect stablecoin LPs from adverse selection. Fees scale from 0.05% in healthy conditions to 1% during severe depeg, with a circuit breaker for extreme events.', status: 'Live', statusColor: '#22c55e' },
  { icon: Bot, title: 'AI Agents', description: 'Autonomous AI agents that manage trading and liquidity strategies collaboratively or independently, executing on-chain actions through natural-language commands.', status: 'Live', statusColor: '#22c55e' },
  { icon: Zap, title: 'Hook Verification', description: 'Trustless hook verification that ensures deployed Uniswap v4 hooks are audited, permissioned, and behaving exactly as intended before liquidity or volume flows through them.', status: 'Live', statusColor: '#22c55e' },
  { icon: Coins, title: 'Portfolio Management', description: 'Unified portfolio tracking and analytics for users and agents, with real-time performance insights and on-chain position management.', status: 'Live', statusColor: '#22c55e' },
  { icon: BarChart3, title: 'Analytics', description: 'Real-time on-chain analytics delivering actionable blockchain insights across markets and liquidity.', status: 'Live', statusColor: '#22c55e' },
  { icon: Lock, title: 'Secure by Design', description: 'Security-first architecture built on battle-tested Uniswap infrastructure, with audited contracts and transparent on-chain operations.', status: 'Live', statusColor: '#22c55e' },
];

const FAQ_DATA = [
  { q: 'What is Mantua.AI?', a: 'Mantua.AI is an agent-driven liquidity protocol for stablecoins that allows users and institutions to manage stablecoin positions, deploy liquidity, and execute automated rebalancing strategies through natural language. It combines Uniswap v4 hooks, autonomous AI agents, and real-time onchain execution to transform user intent into automated liquidity actions. The result is a programmable liquidity layer optimized for stablecoins, RWAs, and yield-bearing dollar assets.' },
  { q: 'What problem does Mantua solve?', a: 'Managing stablecoin liquidity today is operationally manual, interface-fragmented, strategy-dependent, and exposed to peg risk across pools, venues, and market conditions. Mantua.AI enables liquidity providers, stablecoin issuers, fintech platforms, and RWA protocols to deploy peg-aware liquidity, automated rebalancing strategies, and yield-seeking routing logic directly from natural-language instructions, executed onchain via agent-managed Uniswap v4 hook strategies.' },
  { q: 'How does the Stable Protection Hook work?', a: <>The Stable Protection Hook is a Uniswap v4 hook that dynamically adjusts swap fees based on how far a stablecoin pair has drifted from its peg. It defines five depeg zones — Healthy, Minor, Moderate, Severe, and Critical — each with progressively higher fees to discourage arbitrage during volatility and protect LPs from adverse selection. When the peg is healthy, fees stay low (0.05%). As deviation increases, fees scale up automatically to as high as 1%, and a circuit breaker can pause swaps entirely during extreme depeg events. View the source code on <a href="https://github.com/DelleonMcglone/stableprotection-hook" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'underline' }}>GitHub</a>.</> },
  { q: 'What chains does Mantua.AI support?', a: 'We are currently deployed on Base Sepolia. Mainnet deployment on Base is planned after thorough testing and audits.' },
  { q: 'How can I provide liquidity?', a: <>Connect your wallet in the app and navigate to the Liquidity tab to create a pool or add to an existing one. To get testnet tokens on Base Sepolia, visit these faucets:<br /><br />• <a href="https://portal.cdp.coinbase.com/products/faucet" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'underline' }}>Coinbase CDP Faucet</a> — ETH, USDC, cbBTC, and EURC<br />• <a href="https://console.optimism.io/faucet" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'underline' }}>Optimism Faucet</a> — ETH<br />• <a href="https://faucet.circle.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#a855f7', textDecoration: 'underline' }}>Circle Faucet</a> — USDC and EURC<br /><br />Once you have tokens, select your pair, choose a hook strategy (like Stable Protection for stablecoin pairs), enter your amounts, and confirm the transaction.</> },
  { q: 'Is Mantua.AI safe to use?', a: 'Yes. Mantua.AI is designed with safety and transparency in mind: it is built on audited, battle-tested Uniswap infrastructure; uses permissioned, verifiable hooks; and operates with transparent on-chain execution so users retain control of their assets at all times. Smart contracts have undergone security reviews, and Mantua\'s systems are architected to minimize risks common in DeFi such as sandwich attacks, adverse selection, and misconfigured liquidity positions. However, as with any blockchain protocol, users should exercise standard precautions (e.g., reviewing permissions, understanding fees and risks) and may choose to start with modest amounts when trying new features.' },
];

function FeatureCard({ feature, theme, index }) {
  const [hovered, setHovered] = useState(false);
  const Icon = feature.icon;
  
  return (
    <div 
      onMouseEnter={() => setHovered(true)} 
      onMouseLeave={() => setHovered(false)}
      className="transition-all duration-300"
      style={{
        background: hovered ? theme.bgCardHover : theme.bgCard,
        border: `1px solid ${hovered ? theme.borderHover : theme.border}`,
        borderRadius: '16px',
        padding: '28px',
        animation: `fadeInUp 0.5s ease forwards ${index * 0.1}s`,
        opacity: 0,
      }}
    >
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${theme.accent}20, ${theme.accentGreen}20)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
        <Icon size={24} color={theme.accent} />
      </div>
      <h3 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 18, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
        {feature.title}
        <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 8px', borderRadius: 4, background: `${feature.statusColor}20`, color: feature.statusColor }}>{feature.status}</span>
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: theme.textSecondary }}>{feature.description}</p>
    </div>
  );
}

function FAQItem({ item, theme, isOpen, onClick }) {
  return (
    <div style={{ borderBottom: `1px solid ${theme.border}` }}>
      <button onClick={onClick} style={{ width: '100%', background: 'transparent', border: 'none', padding: '20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontFamily: '"Outfit", sans-serif', fontSize: 16, fontWeight: 500, color: theme.textPrimary }}>{item.q}</span>
        <ChevronDown size={20} style={{ color: theme.textMuted, transition: 'transform 0.3s ease', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
      </button>
      <div style={{ overflow: 'hidden', maxHeight: isOpen ? 500 : 0, transition: 'max-height 0.3s ease' }}>
        <div style={{ paddingBottom: 20, fontSize: 14, lineHeight: 1.7, color: theme.textSecondary }}>{item.a}</div>
      </div>
    </div>
  );
}

export default function MantuaLanding() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mantua-theme');
      if (saved) return saved === 'dark';
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem('mantua-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const [openFaq, setOpenFaq] = useState(null);
  const theme = isDark ? themes.dark : themes.light;
  const logo = isDark ? LOGO_BLACK : LOGO_WHITE;

  return (
    <div style={{ minHeight: '100vh', fontFamily: '"DM Sans", sans-serif', background: theme.bgPrimary, color: theme.textPrimary, transition: 'background 0.3s, color 0.3s' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Sans:wght@400;500;600&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Nav */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, padding: '16px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: `${theme.bgPrimary}ee`, backdropFilter: 'blur(12px)', borderBottom: `1px solid ${theme.border}` }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: theme.textPrimary }}>
          <img src={logo} alt="Mantua.AI" style={{ height: 36 }} />
          <span style={{ fontFamily: '"Outfit", sans-serif', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>Mantua.AI</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={() => setIsDark(!isDark)} style={{ background: 'transparent', border: `1px solid ${theme.border}`, borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textSecondary }}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => window.location.href = '/app'} style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', border: 'none', borderRadius: 8, padding: '10px 20px', color: '#fff', fontFamily: '"DM Sans", sans-serif', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Launch App</button>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '120px 40px 80px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 600, background: `radial-gradient(circle, ${theme.accent}15 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <img src={logo} alt="" style={{ width: 120, marginBottom: 32, animation: 'float 4s ease-in-out infinite' }} />
        <h1 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.03em', marginBottom: 24, maxWidth: 800 }}>
          <span style={{ background: 'linear-gradient(135deg, #a855f7 0%, #22c55e 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Mantua.AI</span>
          <br />Agent driven liquidity for Stablecoins
        </h1>
        <p style={{ fontSize: 18, color: theme.textSecondary, marginBottom: 48, letterSpacing: '0.02em' }}>Hooks for logic. Agents for action. AI for intelligence.</p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button onClick={() => window.location.href = '/app'} style={{ background: 'linear-gradient(135deg, #a855f7, #9333ea)', border: 'none', borderRadius: 12, padding: '16px 32px', color: '#fff', fontFamily: '"DM Sans", sans-serif', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Launch App</button>
        </div>
        
        {/* Video Demo Placeholder */}
        <div style={{ marginTop: 64, width: '100%', maxWidth: 900, aspectRatio: '16/9', borderRadius: 16, background: `linear-gradient(135deg, ${theme.accent}10, ${theme.accentGreen}10)`, border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 40%, ${theme.accent}15 0%, transparent 50%), radial-gradient(circle at 70% 60%, ${theme.accentGreen}10 0%, transparent 50%)` }} />
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentGreen})`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 1, boxShadow: `0 8px 32px ${theme.accent}40` }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 4 }}>
              <path d="M8 5.14v14.72a1 1 0 001.5.86l11-7.36a1 1 0 000-1.72l-11-7.36a1 1 0 00-1.5.86z" fill="#fff"/>
            </svg>
          </div>
          <span style={{ fontFamily: '"Outfit", sans-serif', fontSize: 16, fontWeight: 500, color: theme.textSecondary, zIndex: 1 }}>Watch Demo</span>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
          {FEATURES.map((f, i) => <FeatureCard key={i} feature={f} theme={theme} index={i} />)}
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '80px 40px', maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 600, letterSpacing: '-0.02em' }}>Frequently Asked Questions</h2>
        </div>
        <div>{FAQ_DATA.map((item, i) => <FAQItem key={i} item={item} theme={theme} isOpen={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} />)}</div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '60px 40px 40px', borderTop: `1px solid ${theme.border}`, background: theme.bgSecondary }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 48 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={logo} alt="Mantua.AI" style={{ height: 32 }} />
              <span style={{ fontFamily: '"Outfit", sans-serif', fontSize: 18, fontWeight: 600, color: theme.textPrimary }}>Mantua.AI</span>
            </div>
            <p style={{ fontSize: 14, color: theme.textSecondary, lineHeight: 1.6 }}>Agent driven liquidity for Stablecoins.<br />Hooks for logic. Agents for action. AI for intelligence.</p>
          </div>
          <div>
            <h4 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Protocol</h4>
            {['Documentation', 'Github', 'Roadmap', 'Security'].map(l => <a key={l} href="#" style={{ display: 'block', color: theme.textSecondary, textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{l}</a>)}
          </div>
          <div>
            <h4 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resources</h4>
            {['FAQ', 'Brand Kit', 'Blog', 'Analytics'].map(l => <a key={l} href="#" style={{ display: 'block', color: theme.textSecondary, textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{l}</a>)}
          </div>
          <div>
            <h4 style={{ fontFamily: '"Outfit", sans-serif', fontSize: 14, fontWeight: 600, color: theme.textPrimary, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Community</h4>
            {['Discord', 'Telegram', 'X', 'Farcaster'].map(l => <a key={l} href="#" style={{ display: 'block', color: theme.textSecondary, textDecoration: 'none', fontSize: 14, marginBottom: 12 }}>{l}</a>)}
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '48px auto 0', paddingTop: 24, borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span style={{ fontSize: 13, color: theme.textMuted }}>© 2026 Mantua.AI. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ color: theme.textSecondary, textDecoration: 'none', fontSize: 14 }}>Terms</a>
            <a href="#" style={{ color: theme.textSecondary, textDecoration: 'none', fontSize: 14 }}>Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}