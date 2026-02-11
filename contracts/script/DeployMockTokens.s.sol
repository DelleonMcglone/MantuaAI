// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MantuaFaucet} from "../src/faucet/MantuaFaucet.sol";
import {MockToken} from "../src/tokens/MockToken.sol";

/**
 * @title DeployMantuaFaucet
 * @notice Deploys the unified MantuaFaucet and all 21 mock tokens
 */
contract DeployMantuaFaucet is Script {
    struct TokenConfig {
        string name;
        string symbol;
        uint8 decimals;
        uint256 mintAmount;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Faucet
        MantuaFaucet faucet = new MantuaFaucet();
        console.log("MantuaFaucet deployed at:", address(faucet));

        // 2. Define all tokens
        TokenConfig[] memory configs = _getTokenConfigs();

        // 3. Deploy tokens and collect addresses
        address[] memory tokenAddresses = new address[](configs.length);
        uint256[] memory mintAmounts = new uint256[](configs.length);

        for (uint256 i = 0; i < configs.length; i++) {
            MockToken token = new MockToken(
                configs[i].name,
                configs[i].symbol,
                configs[i].decimals,
                address(faucet)
            );

            tokenAddresses[i] = address(token);
            mintAmounts[i] = configs[i].mintAmount;

            console.log(configs[i].symbol, "deployed at:", address(token));
        }

        // 4. Register all tokens with faucet
        faucet.batchAddTokens(tokenAddresses, mintAmounts);
        console.log("All tokens registered with faucet");

        vm.stopBroadcast();

        // 5. Output deployment summary
        _logDeploymentSummary(address(faucet), configs, tokenAddresses);
    }

    function _getTokenConfigs() internal pure returns (TokenConfig[] memory) {
        TokenConfig[] memory configs = new TokenConfig[](21);

        // Stablecoins
        configs[0] = TokenConfig("Mock USDC", "mUSDC", 6, 10_000 * 10**6);
        configs[1] = TokenConfig("Mock USDT", "mUSDT", 6, 10_000 * 10**6);
        configs[2] = TokenConfig("Mock DAI", "mDAI", 18, 10_000 * 10**18);
        configs[3] = TokenConfig("Mock USDe", "mUSDe", 18, 10_000 * 10**18);
        configs[4] = TokenConfig("Mock FRAX", "mFRAX", 18, 10_000 * 10**18);

        // Real World Assets
        configs[5] = TokenConfig("Mock OUSG", "mOUSG", 18, 1_000 * 10**18);
        configs[6] = TokenConfig("Mock USDY", "mUSDY", 18, 1_000 * 10**18);
        configs[7] = TokenConfig("Mock BUIDL", "mBUIDL", 18, 1_000 * 10**18);
        configs[8] = TokenConfig("Mock TBILL", "mTBILL", 18, 1_000 * 10**18);
        configs[9] = TokenConfig("Mock STEUR", "mSTEUR", 18, 1_000 * 10**18);

        // Liquid Staking Tokens
        configs[10] = TokenConfig("Mock Mantle ETH", "mETH", 18, 10 * 10**18);
        configs[11] = TokenConfig("Mock stETH", "mstETH", 18, 10 * 10**18);
        configs[12] = TokenConfig("Mock cbETH", "mcbETH", 18, 10 * 10**18);
        configs[13] = TokenConfig("Mock rETH", "mrETH", 18, 10 * 10**18);
        configs[14] = TokenConfig("Mock wstETH", "mwstETH", 18, 10 * 10**18);

        // Wrapped Assets
        configs[15] = TokenConfig("Mock WBTC", "mWBTC", 8, 0.5 * 10**8);
        configs[16] = TokenConfig("Mock BTC", "mBTC", 8, 0.5 * 10**8);
        configs[17] = TokenConfig("Mock WETH", "mWETH", 18, 10 * 10**18);
        configs[18] = TokenConfig("Mock WSOL", "mWSOL", 18, 10 * 10**18);
        configs[19] = TokenConfig("Mock WAVAX", "mWAVAX", 18, 10 * 10**18);
        configs[20] = TokenConfig("Mock WMATIC", "mWMATIC", 18, 10 * 10**18);

        return configs;
    }

    function _logDeploymentSummary(
        address faucetAddr,
        TokenConfig[] memory configs,
        address[] memory addresses
    ) internal pure {
        console.log("\n========== DEPLOYMENT SUMMARY ==========\n");
        console.log("Copy these addresses to your frontend:\n");
        console.log("FAUCET_ADDRESS:", faucetAddr);
        console.log("");

        for (uint256 i = 0; i < configs.length; i++) {
            console.log(configs[i].symbol, ":", addresses[i]);
        }

        console.log("\n=========================================");
    }
}
