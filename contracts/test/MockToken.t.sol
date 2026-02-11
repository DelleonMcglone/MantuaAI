// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockToken} from "../src/tokens/MockToken.sol";

contract MockTokenTest is Test {
    MockToken public token;
    address public faucet = address(1);
    address public user = address(2);

    function setUp() public {
        token = new MockToken("Mock USDC", "mUSDC", 6, faucet);
    }

    function test_Decimals() public view {
        assertEq(token.decimals(), 6);
    }

    function test_Name() public view {
        assertEq(token.name(), "Mock USDC");
    }

    function test_Symbol() public view {
        assertEq(token.symbol(), "mUSDC");
    }

    function test_FaucetAddress() public view {
        assertEq(token.faucet(), faucet);
    }

    function test_OnlyFaucetCanMint() public {
        vm.prank(faucet);
        token.mint(user, 1000e6);
        assertEq(token.balanceOf(user), 1000e6);
    }

    function test_RevertWhenNonFaucetMints() public {
        vm.prank(user);
        vm.expectRevert(MockToken.OnlyFaucet.selector);
        token.mint(user, 1000e6);
    }

    function test_Burn() public {
        // Mint tokens first
        vm.prank(faucet);
        token.mint(user, 1000e6);

        // User burns their tokens
        vm.prank(user);
        token.burn(500e6);

        assertEq(token.balanceOf(user), 500e6);
    }

    function test_Transfer() public {
        // Mint tokens
        vm.prank(faucet);
        token.mint(user, 1000e6);

        // Transfer to another address
        address recipient = address(3);
        vm.prank(user);
        token.transfer(recipient, 300e6);

        assertEq(token.balanceOf(user), 700e6);
        assertEq(token.balanceOf(recipient), 300e6);
    }

    function test_Approve() public {
        vm.prank(faucet);
        token.mint(user, 1000e6);

        address spender = address(4);
        vm.prank(user);
        token.approve(spender, 500e6);

        assertEq(token.allowance(user, spender), 500e6);
    }

    function test_TransferFrom() public {
        // Mint tokens
        vm.prank(faucet);
        token.mint(user, 1000e6);

        // Approve spender
        address spender = address(4);
        vm.prank(user);
        token.approve(spender, 500e6);

        // Spender transfers
        address recipient = address(5);
        vm.prank(spender);
        token.transferFrom(user, recipient, 300e6);

        assertEq(token.balanceOf(user), 700e6);
        assertEq(token.balanceOf(recipient), 300e6);
        assertEq(token.allowance(user, spender), 200e6);
    }

    function testFuzz_Mint(uint256 amount) public {
        vm.assume(amount < type(uint256).max / 2);

        vm.prank(faucet);
        token.mint(user, amount);

        assertEq(token.balanceOf(user), amount);
    }

    function testFuzz_Burn(uint256 mintAmount, uint256 burnAmount) public {
        vm.assume(mintAmount < type(uint256).max / 2);
        vm.assume(burnAmount <= mintAmount);

        vm.prank(faucet);
        token.mint(user, mintAmount);

        vm.prank(user);
        token.burn(burnAmount);

        assertEq(token.balanceOf(user), mintAmount - burnAmount);
    }
}
