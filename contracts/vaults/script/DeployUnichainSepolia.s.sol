// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * Deploys four MantuaVault instances on Unichain Sepolia.
 *
 * Usage:
 *   cd contracts/vaults
 *   forge script script/DeployUnichainSepolia.s.sol \
 *     --rpc-url $UNICHAIN_SEPOLIA_RPC \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast --verify -vvvv
 */

import { Script, console } from "forge-std/Script.sol";
import { MantuaVault }      from "../src/MantuaVault.sol";

contract DeployUnichainSepolia is Script {
    address constant MOCK_ETH_USDC_LP  = 0x0000000000000000000000000000000000000001;
    address constant MOCK_USDC_USDT_LP = 0x0000000000000000000000000000000000000002;
    address constant MOCK_ETH_BTC_LP   = 0x0000000000000000000000000000000000000003;
    address constant MOCK_MULTI_LP     = 0x0000000000000000000000000000000000000004;

    function run() external {
        address admin = vm.envOr("ADMIN_ADDRESS", msg.sender);
        vm.startBroadcast();

        MantuaVault v1 = new MantuaVault(
            MOCK_ETH_USDC_LP,
            "Mantua ETH/mUSDC Vault",
            "mV-ETH-USDC",
            "ETH/mUSDC LP Vault",
            "lp",
            1240,
            admin
        );

        MantuaVault v2 = new MantuaVault(
            MOCK_USDC_USDT_LP,
            "Mantua mUSDC/mUSDT Vault",
            "mV-STABLE",
            "mUSDC/mUSDT Stable Vault",
            "stable",
            810,
            admin
        );

        MantuaVault v3 = new MantuaVault(
            MOCK_ETH_BTC_LP,
            "Mantua ETH/mBTC Vault",
            "mV-ETH-BTC",
            "ETH/mBTC LP Vault",
            "lp",
            1870,
            admin
        );

        MantuaVault v4 = new MantuaVault(
            MOCK_MULTI_LP,
            "Mantua AI Multi-Strategy Vault",
            "mV-MULTI",
            "AI-Managed Multi-Strategy Vault",
            "multi",
            2420,
            admin
        );

        vm.stopBroadcast();

        console.log("=== Unichain Sepolia Vault Addresses ===");
        console.log("ETH/mUSDC LP Vault:        ", address(v1));
        console.log("mUSDC/mUSDT Stable Vault:  ", address(v2));
        console.log("ETH/mBTC LP Vault:         ", address(v3));
        console.log("AI Multi-Strategy Vault:   ", address(v4));
    }
}
