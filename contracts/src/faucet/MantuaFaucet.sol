// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IMockToken {
    function mint(address to, uint256 amount) external;
}

/**
 * @title MantuaFaucet
 * @notice Unified faucet for all mock tokens with 24-hour cooldown
 * @dev Users can claim all tokens at once with a single cooldown
 */
contract MantuaFaucet is Ownable {
    // Constants
    uint256 public constant COOLDOWN_PERIOD = 24 hours;

    // State
    address[] public tokens;
    mapping(address => uint256) public mintAmounts;
    mapping(address => uint256) public lastClaimTime;

    // Events
    event TokensClaimed(address indexed user, uint256 timestamp);
    event TokenAdded(address indexed token, uint256 mintAmount);
    event MintAmountUpdated(address indexed token, uint256 newAmount);

    // Errors
    error CooldownNotElapsed(uint256 timeRemaining);
    error TokenAlreadyAdded();
    error InvalidToken();
    error InvalidAmount();

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Claim all mock tokens (24-hour cooldown)
     * @dev Mints all registered tokens to the caller
     */
    function claimAll() external {
        uint256 lastClaim = lastClaimTime[msg.sender];
        uint256 elapsed = block.timestamp - lastClaim;

        if (lastClaim != 0 && elapsed < COOLDOWN_PERIOD) {
            revert CooldownNotElapsed(COOLDOWN_PERIOD - elapsed);
        }

        lastClaimTime[msg.sender] = block.timestamp;

        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; ) {
            address token = tokens[i];
            uint256 amount = mintAmounts[token];
            if (amount > 0) {
                IMockToken(token).mint(msg.sender, amount);
            }
            unchecked {
                ++i;
            }
        }

        emit TokensClaimed(msg.sender, block.timestamp);
    }

    /**
     * @notice Check if user can claim
     * @param user The user address to check
     * @return Whether the user can claim tokens
     */
    function canClaim(address user) external view returns (bool) {
        if (lastClaimTime[user] == 0) return true;
        return block.timestamp >= lastClaimTime[user] + COOLDOWN_PERIOD;
    }

    /**
     * @notice Get seconds until next claim is available
     * @param user The user address to check
     * @return Seconds until next claim (0 if can claim now)
     */
    function timeUntilNextClaim(address user) external view returns (uint256) {
        uint256 lastClaim = lastClaimTime[user];
        if (lastClaim == 0) return 0;

        uint256 nextClaimTime = lastClaim + COOLDOWN_PERIOD;
        if (block.timestamp >= nextClaimTime) return 0;

        return nextClaimTime - block.timestamp;
    }

    /**
     * @notice Get all token addresses
     * @return Array of token addresses
     */
    function getAllTokens() external view returns (address[] memory) {
        return tokens;
    }

    /**
     * @notice Get token count
     * @return Number of registered tokens
     */
    function getTokenCount() external view returns (uint256) {
        return tokens.length;
    }

    // ============ Owner Functions ============

    /**
     * @notice Add a new token to the faucet
     * @param token Token contract address
     * @param amount Amount to mint per claim
     */
    function addToken(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) revert InvalidToken();
        if (mintAmounts[token] != 0) revert TokenAlreadyAdded();
        if (amount == 0) revert InvalidAmount();

        tokens.push(token);
        mintAmounts[token] = amount;

        emit TokenAdded(token, amount);
    }

    /**
     * @notice Update mint amount for existing token
     * @param token Token contract address
     * @param amount New mint amount
     */
    function setMintAmount(address token, uint256 amount) external onlyOwner {
        if (mintAmounts[token] == 0) revert InvalidToken();
        mintAmounts[token] = amount;

        emit MintAmountUpdated(token, amount);
    }

    /**
     * @notice Batch add tokens (for initial setup)
     * @param _tokens Array of token addresses
     * @param _amounts Array of mint amounts
     */
    function batchAddTokens(
        address[] calldata _tokens,
        uint256[] calldata _amounts
    ) external onlyOwner {
        require(_tokens.length == _amounts.length, "Length mismatch");

        for (uint256 i = 0; i < _tokens.length; ) {
            if (_tokens[i] == address(0)) revert InvalidToken();
            if (_amounts[i] == 0) revert InvalidAmount();

            tokens.push(_tokens[i]);
            mintAmounts[_tokens[i]] = _amounts[i];

            emit TokenAdded(_tokens[i], _amounts[i]);

            unchecked {
                ++i;
            }
        }
    }
}
