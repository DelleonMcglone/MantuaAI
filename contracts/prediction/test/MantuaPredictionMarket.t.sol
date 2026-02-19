// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MantuaPredictionMarket} from "../src/MantuaPredictionMarket.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract MantuaPredictionMarketTest is Test {
    MantuaPredictionMarket public market;
    ERC20Mock              public usdc;
    address                public admin  = address(1);
    address                public alice  = address(2);
    address                public bob    = address(3);
    uint256                public endTime;

    function setUp() public {
        usdc   = new ERC20Mock();
        market = new MantuaPredictionMarket(address(usdc), admin);
        endTime = block.timestamp + 7 days;

        usdc.mint(alice, 1000e6);
        usdc.mint(bob,   1000e6);

        vm.prank(alice);
        usdc.approve(address(market), type(uint256).max);

        vm.prank(bob);
        usdc.approve(address(market), type(uint256).max);
    }

    function test_createMarket() public {
        vm.prank(admin);
        uint256 id = market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);
        assertEq(id, 1);
        assertEq(market.getMarket(1).question, "Will ETH reach $5k?");
    }

    function test_buyYesShares() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.prank(alice);
        market.buyShares(1, true, 100e6);

        assertEq(market.getMarket(1).totalYesShares, 100e6);
        assertEq(market.getUserPosition(1, alice).yesShares, 100e6);
    }

    function test_buyBothSides() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.prank(alice);
        market.buyShares(1, true, 100e6);

        vm.prank(bob);
        market.buyShares(1, false, 200e6);

        assertEq(market.getYesProbability(1), 33); // 100 / 300
    }

    function test_resolveAndClaim() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.prank(alice);
        market.buyShares(1, true, 100e6);

        vm.prank(bob);
        market.buyShares(1, false, 100e6);

        vm.warp(endTime + 1);

        vm.prank(admin);
        market.resolveMarket(1, true);

        uint256 aliceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        market.claimWinnings(1);

        // Alice gets ~196 USDC (200 pool - 2% fee = 196)
        assertApproxEqAbs(usdc.balanceOf(alice) - aliceBefore, 196e6, 1e6);
    }

    function test_revertBetAfterEndTime() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.warp(endTime + 1);
        vm.prank(alice);
        vm.expectRevert(MantuaPredictionMarket.MarketEnded.selector);
        market.buyShares(1, true, 100e6);
    }

    function test_revertNonResolverCannotResolve() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.warp(endTime + 1);
        vm.prank(alice);
        vm.expectRevert(MantuaPredictionMarket.NotResolver.selector);
        market.resolveMarket(1, true);
    }

    function test_revertDoubleClaimFails() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.prank(alice);
        market.buyShares(1, true, 100e6);

        vm.prank(bob);
        market.buyShares(1, false, 100e6);

        vm.warp(endTime + 1);
        vm.prank(admin);
        market.resolveMarket(1, true);

        vm.prank(alice);
        market.claimWinnings(1);

        vm.prank(alice);
        vm.expectRevert(MantuaPredictionMarket.AlreadyClaimed.selector);
        market.claimWinnings(1);
    }

    function test_defaultYesProbabilityIs50() public {
        vm.prank(admin);
        market.createMarket("Empty market?", "other", endTime, admin);
        assertEq(market.getYesProbability(1), 50);
    }

    function test_revertZeroAmountBet() public {
        vm.prank(admin);
        market.createMarket("Will ETH reach $5k?", "crypto", endTime, admin);

        vm.prank(alice);
        vm.expectRevert(MantuaPredictionMarket.ZeroAmount.selector);
        market.buyShares(1, true, 0);
    }

    function test_getAllMarkets() public {
        vm.startPrank(admin);
        market.createMarket("Market A", "crypto", endTime, admin);
        market.createMarket("Market B", "politics", endTime + 1 days, admin);
        vm.stopPrank();

        MantuaPredictionMarket.Market[] memory all = market.getAllMarkets();
        assertEq(all.length, 2);
        assertEq(all[0].question, "Market A");
        assertEq(all[1].question, "Market B");
    }
}
