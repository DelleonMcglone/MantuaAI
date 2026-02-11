import { useEffect } from 'react';
import { DropletIcon, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';
import { useAppKit } from '@reown/appkit/react';
import { useFaucet, formatCountdown } from '@/hooks/useFaucet';

interface FaucetButtonProps {
  theme: {
    textPrimary: string;
    textMuted: string;
  };
  collapsed?: boolean;
}

export function FaucetButton({ theme, collapsed = false }: FaucetButtonProps) {
  const { isConnected } = useAccount();
  const { open: openConnectModal } = useAppKit();

  const {
    claim,
    canClaim,
    timeUntilNextClaim,
    isLoading,
    isSuccess,
    isError,
    error,
  } = useFaucet();

  // Show success toast
  useEffect(() => {
    if (isSuccess) {
      toast.success('Faucet Claimed', {
        description: 'Test tokens have been sent to your wallet',
      });
    }
  }, [isSuccess]);

  // Show error toast
  useEffect(() => {
    if (isError && error) {
      const message = error.message.includes('User rejected')
        ? 'Transaction cancelled'
        : 'Faucet claim failed';
      toast.error(message);
    }
  }, [isError, error]);

  const handleClick = async () => {
    // Not connected - open Reown wallet modal
    if (!isConnected) {
      openConnectModal();
      return;
    }

    // On cooldown - show info toast
    if (!canClaim) {
      toast.info(`Faucet available in ${formatCountdown(timeUntilNextClaim)}`);
      return;
    }

    // Claim tokens
    try {
      await claim();
    } catch (err) {
      // Error handling is done via useEffect above
      console.error('Faucet claim error:', err);
    }
  };

  // Determine display state
  const getLabel = () => {
    if (isLoading) return 'Processing...';
    if (!isConnected) return 'Faucet';
    if (!canClaim && timeUntilNextClaim > 0) {
      return collapsed ? '⏱️' : `Faucet (${formatCountdown(timeUntilNextClaim)})`;
    }
    return 'Faucet';
  };

  const getIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-5 h-5 animate-spin" />;
    }
    return <DropletIcon className="w-5 h-5" />;
  };

  const isDisabled = isLoading || (!canClaim && isConnected && timeUntilNextClaim > 0);

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        background: 'transparent',
        border: 'none',
        borderRadius: 8,
        color: isDisabled ? theme.textMuted : theme.textPrimary,
        fontSize: 14,
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      {getIcon()} {!collapsed && getLabel()}
    </button>
  );
}
