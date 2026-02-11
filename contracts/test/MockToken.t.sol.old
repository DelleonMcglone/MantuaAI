// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/tokens/MockERC20.sol";
import "../src/tokens/MockTokenFactory.sol";

contract MockERC20Test is Test {
    MockERC20 public token;
    address public owner = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    uint256 constant FAUCET_AMOUNT = 1000 * 10**18;

    function setUp() public {
        token = new MockERC20("Test Token", "TEST", 18, FAUCET_AMOUNT, owner);
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 18);
        assertEq(token.faucetAmount(), FAUCET_AMOUNT);
    }

    function test_Faucet() public {
        vm.prank(user1);
        token.faucet();

        assertEq(token.balanceOf(user1), FAUCET_AMOUNT);
    }

    function test_FaucetCooldown() public {
        vm.startPrank(user1);

        // First claim should succeed
        token.faucet();
        assertEq(token.balanceOf(user1), FAUCET_AMOUNT);

        // Second claim should revert
        vm.expectRevert();
        token.faucet();

        vm.stopPrank();
    }

    function test_FaucetAfterCooldown() public {
        vm.startPrank(user1);

        // First claim
        token.faucet();
        assertEq(token.balanceOf(user1), FAUCET_AMOUNT);

        // Warp time forward past cooldown
        vm.warp(block.timestamp + 1 hours + 1);

        // Second claim should succeed
        token.faucet();
        assertEq(token.balanceOf(user1), FAUCET_AMOUNT * 2);

        vm.stopPrank();
    }

    function test_CanClaimFaucet() public {
        // User has never claimed
        (bool canClaim, uint256 timeRemaining) = token.canClaimFaucet(user1);
        assertTrue(canClaim);
        assertEq(timeRemaining, 0);

        // User claims
        vm.prank(user1);
        token.faucet();

        // User cannot claim immediately
        (canClaim, timeRemaining) = token.canClaimFaucet(user1);
        assertFalse(canClaim);
        assertGt(timeRemaining, 0);

        // Warp past cooldown
        vm.warp(block.timestamp + 1 hours + 1);

        // User can claim again
        (canClaim, timeRemaining) = token.canClaimFaucet(user1);
        assertTrue(canClaim);
        assertEq(timeRemaining, 0);
    }

    function test_OwnerMint() public {
        uint256 mintAmount = 5000 * 10**18;

        vm.prank(owner);
        token.mint(user1, mintAmount);

        assertEq(token.balanceOf(user1), mintAmount);
    }

    function test_NonOwnerCannotMint() public {
        uint256 mintAmount = 5000 * 10**18;

        vm.prank(user1);
        vm.expectRevert();
        token.mint(user1, mintAmount);
    }

    function test_FaucetEmitsEvent() public {
        vm.prank(user1);

        vm.expectEmit(true, false, false, true);
        emit MockERC20.FaucetClaimed(user1, FAUCET_AMOUNT, block.timestamp + 1 hours);

        token.faucet();
    }

    function test_CustomDecimals() public {
        MockERC20 token6 = new MockERC20("USDC", "USDC", 6, 1000 * 10**6, owner);
        assertEq(token6.decimals(), 6);

        MockERC20 token8 = new MockERC20("BTC", "BTC", 8, 1 * 10**8, owner);
        assertEq(token8.decimals(), 8);
    }
}

contract MockTokenFactoryTest is Test {
    MockTokenFactory public factory;
    address public user1 = address(2);

    function setUp() public {
        factory = new MockTokenFactory();
    }

    function test_AllTokensDeployed() public {
        factory.deployAllTokens();

        assertTrue(address(factory.mUSDC()) != address(0));
        assertTrue(address(factory.mETH()) != address(0));
        assertTrue(address(factory.mDAI()) != address(0));
        assertTrue(address(factory.mBTC()) != address(0));
        assertTrue(address(factory.mLINK()) != address(0));
        assertTrue(address(factory.mUSDT()) != address(0));
        assertTrue(address(factory.mUSDE()) != address(0));
        assertTrue(factory.deployed());
    }

    function test_TokenDecimals() public {
        factory.deployAllTokens();

        assertEq(factory.mUSDC().decimals(), 6);
        assertEq(factory.mETH().decimals(), 18);
        assertEq(factory.mDAI().decimals(), 18);
        assertEq(factory.mBTC().decimals(), 8);
        assertEq(factory.mLINK().decimals(), 18);
        assertEq(factory.mUSDT().decimals(), 6);
        assertEq(factory.mUSDE().decimals(), 18);
    }

    function test_GetAllTokens() public {
        factory.deployAllTokens();

        address[] memory tokens = factory.getAllTokens();
        assertEq(tokens.length, 7);
        assertEq(tokens[0], address(factory.mUSDC()));
        assertEq(tokens[1], address(factory.mETH()));
        assertEq(tokens[2], address(factory.mDAI()));
        assertEq(tokens[3], address(factory.mBTC()));
        assertEq(tokens[4], address(factory.mLINK()));
        assertEq(tokens[5], address(factory.mUSDT()));
        assertEq(tokens[6], address(factory.mUSDE()));
    }

    function test_CannotDeployTwice() public {
        factory.deployAllTokens();

        vm.expectRevert(MockTokenFactory.AlreadyDeployed.selector);
        factory.deployAllTokens();
    }

    function test_ClaimAllFaucets() public {
        factory.deployAllTokens();

        vm.prank(user1);
        factory.claimAllFaucets();

        // Check that user received tokens from all faucets
        assertEq(factory.mUSDC().balanceOf(user1), 10_000 * 10**6);
        assertEq(factory.mETH().balanceOf(user1), 10 * 10**18);
        assertEq(factory.mDAI().balanceOf(user1), 10_000 * 10**18);
        assertEq(factory.mBTC().balanceOf(user1), 1 * 10**8);
        assertEq(factory.mLINK().balanceOf(user1), 100 * 10**18);
        assertEq(factory.mUSDT().balanceOf(user1), 10_000 * 10**6);
        assertEq(factory.mUSDE().balanceOf(user1), 10_000 * 10**18);
    }

    function test_CheckAllFaucets() public {
        factory.deployAllTokens();

        // Before claiming
        (string[] memory symbols, bool[] memory canClaim, uint256[] memory timeUntilNext) =
            factory.checkAllFaucets(user1);

        assertEq(symbols.length, 7);
        assertEq(canClaim.length, 7);
        assertEq(timeUntilNext.length, 7);

        // All should be claimable
        for (uint256 i = 0; i < 7; i++) {
            assertTrue(canClaim[i]);
            assertEq(timeUntilNext[i], 0);
        }

        // Claim from user1
        vm.prank(user1);
        factory.claimAllFaucets();

        // After claiming
        (symbols, canClaim, timeUntilNext) = factory.checkAllFaucets(user1);

        // None should be claimable immediately
        for (uint256 i = 0; i < 7; i++) {
            assertFalse(canClaim[i]);
            assertGt(timeUntilNext[i], 0);
        }

        // Warp past cooldown
        vm.warp(block.timestamp + 1 hours + 1);

        // All should be claimable again
        (symbols, canClaim, timeUntilNext) = factory.checkAllFaucets(user1);
        for (uint256 i = 0; i < 7; i++) {
            assertTrue(canClaim[i]);
            assertEq(timeUntilNext[i], 0);
        }
    }

    function test_MintLiquidity() public {
        factory.deployAllTokens();

        address recipient = address(4);
        uint256 amount = 1_000_000 * 10**6;

        factory.mintLiquidity(address(factory.mUSDC()), recipient, amount);

        assertEq(factory.mUSDC().balanceOf(recipient), amount);
    }

    function test_CannotMintNonFactoryToken() public {
        factory.deployAllTokens();

        MockERC20 externalToken = new MockERC20("EXT", "EXT", 18, 100 * 10**18, address(this));

        vm.expectRevert(MockTokenFactory.NotTokenOwner.selector);
        factory.mintLiquidity(address(externalToken), user1, 1000 * 10**18);
    }

    function test_SymbolsCorrect() public {
        factory.deployAllTokens();

        (string[] memory symbols,,) = factory.checkAllFaucets(user1);

        assertEq(symbols[0], "mUSDC");
        assertEq(symbols[1], "mETH");
        assertEq(symbols[2], "mDAI");
        assertEq(symbols[3], "mBTC");
        assertEq(symbols[4], "mLINK");
        assertEq(symbols[5], "mUSDT");
        assertEq(symbols[6], "mUSDE");
    }
}
