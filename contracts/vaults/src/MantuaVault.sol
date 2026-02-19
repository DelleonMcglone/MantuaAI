// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title  MantuaVault
 * @notice ERC-4626 compliant tokenised vault that accepts LP tokens and simulates yield.
 *         Four instances are deployed with distinct strategies and APYs.
 *
 * @dev    Yield simulation: the owner periodically calls `accrueYield()` to credit interest
 *         directly into the contract's asset balance (funded from a separate yield reserve).
 *         This inflates `totalAssets()` and therefore the share price, so all existing
 *         depositors benefit pro-rata — identical to a real yield strategy.
 */

import { ERC4626 }        from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 }          from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 }         from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 }      from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable }        from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MantuaVault is ERC4626, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── State ────────────────────────────────────────────────────────────────

    /// Strategy label: "stable" | "lp" | "multi"
    string  public strategy;

    /// Annual percentage yield in basis points (e.g. 1240 = 12.40 %)
    uint256 public apyBps;

    /// Human-readable vault name for UI
    string  public vaultName;

    /// Whether the vault is paused (no deposits / withdrawals)
    bool    public paused;

    /// Timestamp of last yield accrual
    uint256 public lastAccrualTimestamp;

    // ── Events ───────────────────────────────────────────────────────────────

    event YieldAccrued(uint256 amount, uint256 newTotalAssets);
    event VaultPaused(bool paused);
    event ApyUpdated(uint256 oldApyBps, uint256 newApyBps);

    // ── Errors ───────────────────────────────────────────────────────────────

    error VaultPausedError();
    error ZeroAmount();
    error ApyTooHigh();

    // ── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _asset       LP token (or any ERC-20) accepted by this vault
     * @param _name        Vault share token name (e.g. "Mantua ETH/USDC Vault")
     * @param _symbol      Vault share token symbol (e.g. "mV-ETH-USDC")
     * @param _vaultName   Human-readable label shown in the UI
     * @param _strategy    Strategy identifier: "stable" | "lp" | "multi"
     * @param _apyBps      APY in basis points (max 10000 = 100%)
     * @param _owner       Initial owner / admin address
     */
    constructor(
        address _asset,
        string memory _name,
        string memory _symbol,
        string memory _vaultName,
        string memory _strategy,
        uint256 _apyBps,
        address _owner
    )
        ERC4626(IERC20(_asset))
        ERC20(_name, _symbol)
        Ownable(_owner)
    {
        if (_apyBps > 10_000) revert ApyTooHigh();
        vaultName             = _vaultName;
        strategy              = _strategy;
        apyBps                = _apyBps;
        lastAccrualTimestamp  = block.timestamp;
    }

    // ── Modifiers ────────────────────────────────────────────────────────────

    modifier whenNotPaused() {
        if (paused) revert VaultPausedError();
        _;
    }

    // ── ERC-4626 overrides ───────────────────────────────────────────────────

    function deposit(uint256 assets, address receiver)
        public override nonReentrant whenNotPaused returns (uint256)
    {
        if (assets == 0) revert ZeroAmount();
        return super.deposit(assets, receiver);
    }

    function mint(uint256 shares, address receiver)
        public override nonReentrant whenNotPaused returns (uint256)
    {
        if (shares == 0) revert ZeroAmount();
        return super.mint(shares, receiver);
    }

    function withdraw(uint256 assets, address receiver, address owner_)
        public override nonReentrant whenNotPaused returns (uint256)
    {
        if (assets == 0) revert ZeroAmount();
        return super.withdraw(assets, receiver, owner_);
    }

    function redeem(uint256 shares, address receiver, address owner_)
        public override nonReentrant whenNotPaused returns (uint256)
    {
        if (shares == 0) revert ZeroAmount();
        return super.redeem(shares, receiver, owner_);
    }

    // ── Yield simulation ─────────────────────────────────────────────────────

    /**
     * @notice Owner calls this to credit pending yield into the vault.
     *         Transfers `amount` of the asset from caller into the vault,
     *         inflating totalAssets() and thus the share price.
     * @param  amount  Asset amount to deposit as yield (must be pre-approved)
     */
    function accrueYield(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        lastAccrualTimestamp = block.timestamp;
        emit YieldAccrued(amount, totalAssets());
    }

    /**
     * @notice Returns the pending yield (not yet accrued) based on elapsed time.
     *         Useful for off-chain display / keeper bots.
     */
    function pendingYield() external view returns (uint256) {
        if (totalAssets() == 0) return 0;
        uint256 elapsed = block.timestamp - lastAccrualTimestamp;
        // yield = assets * apyBps * elapsed / (365 days * 10000)
        return (totalAssets() * apyBps * elapsed) / (365 days * 10_000);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit VaultPaused(_paused);
    }

    function setApyBps(uint256 _apyBps) external onlyOwner {
        if (_apyBps > 10_000) revert ApyTooHigh();
        emit ApyUpdated(apyBps, _apyBps);
        apyBps = _apyBps;
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    /**
     * @notice Returns key vault stats in one call (saves RPC round-trips).
     */
    function getVaultStats() external view returns (
        uint256 _totalAssets,
        uint256 _totalSupply,
        uint256 _pricePerShare,
        uint256 _apyBps,
        bool    _paused
    ) {
        _totalAssets   = totalAssets();
        _totalSupply   = totalSupply();
        _pricePerShare = _totalSupply == 0
            ? 1e18
            : (_totalAssets * 1e18) / _totalSupply;
        _apyBps  = apyBps;
        _paused  = paused;
    }
}
