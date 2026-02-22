/**
 * VoiceCommandSummary — renders a human-readable structured summary of a parsed command.
 * Extracted from VoiceConfirmationModal to stay within the 150-line file limit.
 */
import React from 'react';
import type { SwapCommand, LiquidityCommand } from '@shared/voiceCommandParser';
import type { HookType } from '@shared/voiceCommandTypes';

type ParsedCommand = SwapCommand | LiquidityCommand;

const HOOK_LABELS: Record<HookType, string> = {
  jit: 'JIT Hook',
  'mev-protection': 'MEV Protection Hook',
};

function hookSpan(hook: HookType | undefined) {
  if (!hook) return null;
  return <span style={{ color: '#818cf8' }}> via {HOOK_LABELS[hook]}</span>;
}

function liquidityAmounts(cmd: LiquidityCommand): string {
  if (cmd.amount0 && cmd.amount1) return ` (${cmd.amount0} ${cmd.token0} + ${cmd.amount1} ${cmd.token1})`;
  if (cmd.amount0) return ` (${cmd.amount0} ${cmd.token0})`;
  if (cmd.amount1) return ` (${cmd.amount1} ${cmd.token1})`;
  return '';
}

export function VoiceCommandSummary({ command }: { command: ParsedCommand }) {
  const ps: React.CSSProperties = { margin: '12px 0 0', fontSize: 15 };
  if (command.type === 'swap') {
    return (
      <p style={ps}>
        Swap <strong>{command.amount} {command.fromToken}</strong>{' → '}<strong>{command.toToken}</strong>
        {hookSpan(command.hook)}
      </p>
    );
  }
  const action = command.action === 'add' ? 'Add liquidity' : 'Remove liquidity';
  const amounts = liquidityAmounts(command);
  return (
    <p style={ps}>
      <strong>{action}</strong> to <strong>{command.token0}/{command.token1}</strong>
      {amounts && <span style={{ color: '#6b7280' }}>{amounts}</span>}
      {hookSpan(command.hook)}
    </p>
  );
}
