// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMantuaPredictionMarket {
    struct Market {
        uint256 id;
        string  question;
        string  category;
        uint256 endTime;
        bool    resolved;
        bool    outcome;
        uint256 totalYesShares;
        uint256 totalNoShares;
        address resolver;
    }

    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool    claimed;
    }

    event MarketCreated(uint256 indexed marketId, string question, string category, uint256 endTime, address resolver);
    event SharesBought(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 shares);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 payout);

    function createMarket(string calldata question, string calldata category, uint256 endTime, address resolver) external returns (uint256);
    function buyShares(uint256 marketId, bool isYes, uint256 amount) external;
    function resolveMarket(uint256 marketId, bool outcome) external;
    function claimWinnings(uint256 marketId) external;
    function getMarket(uint256 marketId) external view returns (Market memory);
    function getUserPosition(uint256 marketId, address user) external view returns (Position memory);
    function getYesProbability(uint256 marketId) external view returns (uint256);
    function getAllMarkets() external view returns (Market[] memory);
}
