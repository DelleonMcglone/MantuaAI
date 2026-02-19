// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {MantuaPredictionMarket} from "../src/MantuaPredictionMarket.sol";

contract DeployBaseSepolia is Script {
    // Mock USDC on Base Sepolia — matches contracts.ts mUSDC address
    address constant MOCK_USDC = 0x3365571b822a54c01816bC75b586317F4c1B3E47;
    // Admin address — set to your deployer wallet via ADMIN_ADDRESS env var
    address immutable ADMIN;

    constructor() {
        ADMIN = vm.envAddress("ADMIN_ADDRESS");
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        MantuaPredictionMarket pm = new MantuaPredictionMarket(MOCK_USDC, ADMIN);
        console.log("MantuaPredictionMarket deployed to:", address(pm));

        // Seed 5 demo markets for hackathon
        uint256 oneWeek  = block.timestamp + 7 days;
        uint256 twoWeeks = block.timestamp + 14 days;

        pm.createMarket("Will ETH exceed $4,000 by end of Q1 2026?",  "crypto",    oneWeek,  ADMIN);
        pm.createMarket("Will the Fed cut rates in March 2026?",       "economics", twoWeeks, ADMIN);
        pm.createMarket("Will Bitcoin reach a new ATH in 2026?",       "crypto",    twoWeeks, ADMIN);
        pm.createMarket("Will Base TVL exceed $10B by April 2026?",    "crypto",    oneWeek,  ADMIN);
        pm.createMarket("Will Uniswap v4 launch on mainnet in 2026?",  "crypto",    oneWeek,  ADMIN);

        vm.stopBroadcast();
        console.log("5 demo markets created.");
        console.log("Update MANTUA_PREDICTION_MARKET[84532] in client/src/config/contracts.ts");
    }
}
