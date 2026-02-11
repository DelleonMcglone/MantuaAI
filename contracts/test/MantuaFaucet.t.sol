// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MantuaFaucet} from "../src/faucet/MantuaFaucet.sol";
import {MockToken} from "../src/tokens/MockToken.sol";

contract MantuaFaucetTest is Test {
    MantuaFaucet public faucet;
    MockToken public mUSDC;
    MockToken public mWBTC;

    address public user = address(10);

    function setUp() public {
        faucet = new MantuaFaucet();

        // Deploy tokens with faucet as minter
        mUSDC = new MockToken("Mock USDC", "mUSDC", 6, address(faucet));
        mWBTC = new MockToken("Mock WBTC", "mWBTC", 8, address(faucet));

        // Register tokens
        faucet.addToken(address(mUSDC), 10_000e6); // 10,000 USDC
        faucet.addToken(address(mWBTC), 0.5e8); // 0.5 WBTC
    }

    function test_ClaimAll() public {
        vm.prank(user);
        faucet.claimAll();

        assertEq(mUSDC.balanceOf(user), 10_000e6);
        assertEq(mWBTC.balanceOf(user), 0.5e8);
    }

    function test_CooldownEnforced() public {
        vm.startPrank(user);

        faucet.claimAll();

        // Try to claim again immediately
        vm.expectRevert();
        faucet.claimAll();

        vm.stopPrank();
    }

    function test_ClaimAfterCooldown() public {
        vm.startPrank(user);

        faucet.claimAll();

        // Warp forward 24 hours
        vm.warp(block.timestamp + 24 hours);

        // Should succeed
        faucet.claimAll();

        // Balance should be doubled
        assertEq(mUSDC.balanceOf(user), 20_000e6);

        vm.stopPrank();
    }

    function test_CanClaim() public {
        assertTrue(faucet.canClaim(user));

        vm.prank(user);
        faucet.claimAll();

        assertFalse(faucet.canClaim(user));

        vm.warp(block.timestamp + 24 hours);

        assertTrue(faucet.canClaim(user));
    }

    function test_TimeUntilNextClaim() public {
        assertEq(faucet.timeUntilNextClaim(user), 0);

        vm.prank(user);
        faucet.claimAll();

        assertEq(faucet.timeUntilNextClaim(user), 24 hours);

        vm.warp(block.timestamp + 12 hours);

        assertEq(faucet.timeUntilNextClaim(user), 12 hours);
    }

    function test_GetAllTokens() public view {
        address[] memory allTokens = faucet.getAllTokens();
        assertEq(allTokens.length, 2);
        assertEq(allTokens[0], address(mUSDC));
        assertEq(allTokens[1], address(mWBTC));
    }

    function test_GetTokenCount() public view {
        assertEq(faucet.getTokenCount(), 2);
    }

    function test_AddToken() public {
        MockToken mDAI = new MockToken("Mock DAI", "mDAI", 18, address(faucet));

        vm.expectEmit(true, false, false, true);
        emit MantuaFaucet.TokenAdded(address(mDAI), 10_000e18);

        faucet.addToken(address(mDAI), 10_000e18);

        assertEq(faucet.getTokenCount(), 3);
        assertEq(faucet.mintAmounts(address(mDAI)), 10_000e18);
    }

    function test_RevertAddTokenTwice() public {
        vm.expectRevert(MantuaFaucet.TokenAlreadyAdded.selector);
        faucet.addToken(address(mUSDC), 5_000e6);
    }

    function test_RevertAddZeroAddress() public {
        vm.expectRevert(MantuaFaucet.InvalidToken.selector);
        faucet.addToken(address(0), 1000e18);
    }

    function test_RevertAddZeroAmount() public {
        MockToken mDAI = new MockToken("Mock DAI", "mDAI", 18, address(faucet));

        vm.expectRevert(MantuaFaucet.InvalidAmount.selector);
        faucet.addToken(address(mDAI), 0);
    }

    function test_SetMintAmount() public {
        vm.expectEmit(true, false, false, true);
        emit MantuaFaucet.MintAmountUpdated(address(mUSDC), 5_000e6);

        faucet.setMintAmount(address(mUSDC), 5_000e6);

        assertEq(faucet.mintAmounts(address(mUSDC)), 5_000e6);

        // Verify new amount is used
        vm.prank(user);
        faucet.claimAll();

        assertEq(mUSDC.balanceOf(user), 5_000e6);
    }

    function test_RevertSetMintAmountInvalidToken() public {
        MockToken mDAI = new MockToken("Mock DAI", "mDAI", 18, address(faucet));

        vm.expectRevert(MantuaFaucet.InvalidToken.selector);
        faucet.setMintAmount(address(mDAI), 5_000e18);
    }

    function test_BatchAddTokens() public {
        MockToken mDAI = new MockToken("Mock DAI", "mDAI", 18, address(faucet));
        MockToken mETH = new MockToken("Mock ETH", "mETH", 18, address(faucet));

        address[] memory newTokens = new address[](2);
        newTokens[0] = address(mDAI);
        newTokens[1] = address(mETH);

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10_000e18;
        amounts[1] = 10e18;

        faucet.batchAddTokens(newTokens, amounts);

        assertEq(faucet.getTokenCount(), 4);
        assertEq(faucet.mintAmounts(address(mDAI)), 10_000e18);
        assertEq(faucet.mintAmounts(address(mETH)), 10e18);
    }

    function test_RevertBatchAddLengthMismatch() public {
        address[] memory newTokens = new address[](2);
        uint256[] memory amounts = new uint256[](1);

        vm.expectRevert("Length mismatch");
        faucet.batchAddTokens(newTokens, amounts);
    }

    function test_OnlyOwnerCanAddToken() public {
        MockToken mDAI = new MockToken("Mock DAI", "mDAI", 18, address(faucet));

        vm.prank(user);
        vm.expectRevert();
        faucet.addToken(address(mDAI), 10_000e18);
    }

    function test_OnlyOwnerCanSetMintAmount() public {
        vm.prank(user);
        vm.expectRevert();
        faucet.setMintAmount(address(mUSDC), 5_000e6);
    }

    function test_OnlyOwnerCanBatchAdd() public {
        address[] memory newTokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);

        vm.prank(user);
        vm.expectRevert();
        faucet.batchAddTokens(newTokens, amounts);
    }

    function test_EmitTokensClaimedEvent() public {
        vm.prank(user);

        vm.expectEmit(true, false, false, true);
        emit MantuaFaucet.TokensClaimed(user, block.timestamp);

        faucet.claimAll();
    }

    function test_CooldownErrorMessage() public {
        vm.prank(user);
        faucet.claimAll();

        // Warp forward 12 hours
        vm.warp(block.timestamp + 12 hours);

        vm.prank(user);
        vm.expectRevert(
            abi.encodeWithSelector(
                MantuaFaucet.CooldownNotElapsed.selector,
                12 hours
            )
        );
        faucet.claimAll();
    }

    function testFuzz_ClaimAfterVariousTimes(uint256 warpTime) public {
        vm.assume(warpTime >= 24 hours && warpTime < 365 days);

        vm.prank(user);
        faucet.claimAll();

        vm.warp(block.timestamp + warpTime);

        vm.prank(user);
        faucet.claimAll();

        // Should have claimed twice
        assertEq(mUSDC.balanceOf(user), 20_000e6);
    }
}
