// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Test, console } from "forge-std/Test.sol";
import { MantuaVault }   from "../src/MantuaVault.sol";
import { ERC20 }         from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mock LP token for testing
contract MockLP is ERC20 {
    constructor() ERC20("Mock LP", "mLP") {
        _mint(msg.sender, 1_000_000e18);
    }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract MantuaVaultTest is Test {
    MantuaVault vault;
    MockLP      lp;

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address owner = address(this);

    uint256 constant APY_BPS = 1240; // 12.40%

    function setUp() public {
        lp    = new MockLP();
        vault = new MantuaVault(
            address(lp),
            "Mantua ETH/USDC Vault",
            "mV-ETH-USDC",
            "ETH/mUSDC LP Vault",
            "lp",
            APY_BPS,
            owner
        );
        // Fund test users
        lp.mint(alice, 10_000e18);
        lp.mint(bob,   10_000e18);
    }

    // ── Test 1: Basic deposit mints correct shares ────────────────────────

    function test_depositMintsShares() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 1_000e18);
        uint256 shares = vault.deposit(1_000e18, alice);
        vm.stopPrank();

        assertEq(shares, 1_000e18, "first deposit: shares == assets (1:1)");
        assertEq(vault.balanceOf(alice), 1_000e18);
        assertEq(vault.totalAssets(), 1_000e18);
    }

    // ── Test 2: Withdraw returns correct assets ───────────────────────────

    function test_withdrawReturnsAssets() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18, alice);

        uint256 balBefore = lp.balanceOf(alice);
        vault.withdraw(1_000e18, alice, alice);
        uint256 balAfter = lp.balanceOf(alice);
        vm.stopPrank();

        assertEq(balAfter - balBefore, 1_000e18, "full withdrawal returns same assets");
        assertEq(vault.balanceOf(alice), 0);
    }

    // ── Test 3: Redeem shares ─────────────────────────────────────────────

    function test_redeemShares() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 500e18);
        uint256 shares = vault.deposit(500e18, alice);
        vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 0);
        assertEq(lp.balanceOf(alice), 10_000e18, "alice gets back initial balance");
    }

    // ── Test 4: Yield accrual inflates pricePerShare ──────────────────────

    function test_accrueYieldInflatesPrice() public {
        // Alice deposits
        vm.startPrank(alice);
        lp.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18, alice);
        vm.stopPrank();

        // Owner accrues 100 tokens of yield
        lp.approve(address(vault), 100e18);
        vault.accrueYield(100e18);

        // Price per share should now be > 1
        (, , uint256 pricePerShare, , ) = vault.getVaultStats();
        assertGt(pricePerShare, 1e18, "price per share inflated after yield");

        // Alice withdraws and gets more than deposited
        vm.startPrank(alice);
        uint256 shares = vault.balanceOf(alice);
        vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertGt(lp.balanceOf(alice), 10_000e18, "alice receives yield");
    }

    // ── Test 5: Multiple depositors share yield pro-rata ─────────────────

    function test_multipleDepositorProRataYield() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        lp.approve(address(vault), 1_000e18);
        vault.deposit(1_000e18, bob);
        vm.stopPrank();

        // Accrue 200 tokens of yield (100 each)
        lp.approve(address(vault), 200e18);
        vault.accrueYield(200e18);

        uint256 aliceAssets = vault.previewRedeem(vault.balanceOf(alice));
        uint256 bobAssets   = vault.previewRedeem(vault.balanceOf(bob));

        assertApproxEqAbs(aliceAssets, 1_100e18, 1e15, "alice gets half the yield");
        assertApproxEqAbs(bobAssets,   1_100e18, 1e15, "bob gets half the yield");
    }

    // ── Test 6: Pause blocks deposits ────────────────────────────────────

    function test_pauseBlocksDeposit() public {
        vault.setPaused(true);

        vm.startPrank(alice);
        lp.approve(address(vault), 100e18);
        vm.expectRevert(MantuaVault.VaultPausedError.selector);
        vault.deposit(100e18, alice);
        vm.stopPrank();
    }

    // ── Test 7: Pause blocks withdrawals ─────────────────────────────────

    function test_pauseBlocksWithdraw() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 100e18);
        vault.deposit(100e18, alice);
        vm.stopPrank();

        vault.setPaused(true);

        vm.startPrank(alice);
        vm.expectRevert(MantuaVault.VaultPausedError.selector);
        vault.redeem(vault.balanceOf(alice), alice, alice);
        vm.stopPrank();
    }

    // ── Test 8: Non-owner cannot pause ───────────────────────────────────

    function test_onlyOwnerCanPause() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setPaused(true);
    }

    // ── Test 9: getVaultStats returns correct data ────────────────────────

    function test_getVaultStats() public {
        vm.startPrank(alice);
        lp.approve(address(vault), 2_000e18);
        vault.deposit(2_000e18, alice);
        vm.stopPrank();

        (
            uint256 ta,
            uint256 ts,
            uint256 pps,
            uint256 apy,
            bool    isPaused
        ) = vault.getVaultStats();

        assertEq(ta,       2_000e18,  "totalAssets");
        assertEq(ts,       2_000e18,  "totalSupply");
        assertEq(pps,      1e18,      "pricePerShare = 1 before yield");
        assertEq(apy,      APY_BPS,   "apyBps");
        assertFalse(isPaused,         "not paused");
    }
}
