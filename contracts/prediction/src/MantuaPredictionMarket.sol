// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title MantuaPredictionMarket
 * @notice Binary prediction market settling in mock USDC.
 *         Markets resolve to YES (true) or NO (false) by an admin.
 * @dev Deployed on Base Sepolia (84532).
 */

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MantuaPredictionMarket is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    struct Market {
        uint256 id;
        string  question;
        string  category;
        uint256 endTime;
        bool    resolved;
        bool    outcome;          // true = YES wins
        uint256 totalYesShares;   // 1 share = 1 USDC deposited on YES side
        uint256 totalNoShares;
        address resolver;
    }

    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool    claimed;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    IERC20  public immutable usdc;
    uint256 public marketCount;
    uint256 public constant FEE_BPS = 200; // 2% protocol fee on winnings

    mapping(uint256 => Market)                          public markets;
    mapping(uint256 => mapping(address => Position))    public positions;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event MarketCreated(
        uint256 indexed marketId,
        string  question,
        string  category,
        uint256 endTime,
        address resolver
    );
    event SharesBought(
        uint256 indexed marketId,
        address indexed user,
        bool    isYes,
        uint256 amount,
        uint256 shares
    );
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    error MarketNotFound();
    error MarketAlreadyResolved();
    error MarketNotResolved();
    error MarketNotEnded();
    error MarketEnded();
    error NotResolver();
    error ZeroAmount();
    error AlreadyClaimed();
    error NoWinningShares();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20(_usdc);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Market Lifecycle
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Create a new binary prediction market.
     * @param question  Human-readable market question.
     * @param category  Category tag (politics|crypto|sports|economics|other).
     * @param endTime   Unix timestamp after which no new bets are accepted.
     * @param resolver  Address authorised to resolve this market (usually admin).
     */
    function createMarket(
        string  calldata question,
        string  calldata category,
        uint256          endTime,
        address          resolver
    ) external onlyOwner returns (uint256 marketId) {
        require(endTime > block.timestamp, "End time must be in future");
        require(resolver != address(0),    "Invalid resolver");

        marketId = ++marketCount;
        markets[marketId] = Market({
            id:             marketId,
            question:       question,
            category:       category,
            endTime:        endTime,
            resolved:       false,
            outcome:        false,
            totalYesShares: 0,
            totalNoShares:  0,
            resolver:       resolver
        });

        emit MarketCreated(marketId, question, category, endTime, resolver);
    }

    /**
     * @notice Buy YES or NO shares in a market.
     * @param marketId  Target market.
     * @param isYes     True to buy YES shares, false for NO shares.
     * @param amount    Amount of USDC (in 6-decimal units) to spend.
     */
    function buyShares(
        uint256 marketId,
        bool    isYes,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0)                              revert ZeroAmount();
        Market storage m = _getActiveMarket(marketId);
        if (block.timestamp >= m.endTime)            revert MarketEnded();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        Position storage pos = positions[marketId][msg.sender];

        if (isYes) {
            m.totalYesShares += amount;
            pos.yesShares    += amount;
        } else {
            m.totalNoShares  += amount;
            pos.noShares     += amount;
        }

        emit SharesBought(marketId, msg.sender, isYes, amount, amount);
    }

    /**
     * @notice Resolve a market. Only callable by the market's resolver.
     * @param marketId  Market to resolve.
     * @param outcome   True = YES wins, false = NO wins.
     */
    function resolveMarket(uint256 marketId, bool outcome) external {
        Market storage m = _getActiveMarket(marketId);
        if (msg.sender != m.resolver) revert NotResolver();
        if (block.timestamp < m.endTime) revert MarketNotEnded();

        m.resolved = true;
        m.outcome  = outcome;

        emit MarketResolved(marketId, outcome);
    }

    /**
     * @notice Claim winnings from a resolved market.
     * @param marketId  Resolved market to claim from.
     */
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market   storage m   = markets[marketId];
        Position storage pos = positions[marketId][msg.sender];

        if (!m.resolved)   revert MarketNotResolved();
        if (pos.claimed)   revert AlreadyClaimed();

        uint256 winningShares = m.outcome ? pos.yesShares : pos.noShares;
        if (winningShares == 0) revert NoWinningShares();

        uint256 totalWinning = m.outcome ? m.totalYesShares : m.totalNoShares;
        uint256 totalLoser   = m.outcome ? m.totalNoShares  : m.totalYesShares;
        uint256 totalPool    = totalWinning + totalLoser;

        // Proportional payout: winner's share of total pool minus 2% fee
        uint256 grossPayout  = (winningShares * totalPool) / totalWinning;
        uint256 fee          = (grossPayout * FEE_BPS) / 10_000;
        uint256 netPayout    = grossPayout - fee;

        pos.claimed = true;
        usdc.safeTransfer(msg.sender, netPayout);

        emit WinningsClaimed(marketId, msg.sender, netPayout);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return markets[marketId];
    }

    function getUserPosition(uint256 marketId, address user)
        external view returns (Position memory)
    {
        return positions[marketId][user];
    }

    /**
     * @notice Returns YES probability as a percentage (0-100) based on share ratio.
     *         Simple approximation: yesShares / totalShares * 100.
     */
    function getYesProbability(uint256 marketId) external view returns (uint256) {
        Market storage m = markets[marketId];
        uint256 total = m.totalYesShares + m.totalNoShares;
        if (total == 0) return 50; // 50/50 default for new markets
        return (m.totalYesShares * 100) / total;
    }

    function getAllMarkets() external view returns (Market[] memory) {
        Market[] memory all = new Market[](marketCount);
        for (uint256 i = 1; i <= marketCount; i++) {
            all[i - 1] = markets[i];
        }
        return all;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /** @notice Withdraw accumulated fees. */
    function withdrawFees(address recipient) external onlyOwner {
        usdc.safeTransfer(recipient, usdc.balanceOf(address(this)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────────────

    function _getActiveMarket(uint256 marketId) internal view returns (Market storage m) {
        if (marketId == 0 || marketId > marketCount) revert MarketNotFound();
        m = markets[marketId];
        if (m.resolved) revert MarketAlreadyResolved();
    }
}
