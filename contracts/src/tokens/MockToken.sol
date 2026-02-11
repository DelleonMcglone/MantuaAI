// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockToken
 * @notice Simple ERC20 token for testnet use
 * @dev Only the faucet contract can mint tokens
 */
contract MockToken is ERC20 {
    uint8 private immutable _decimals;
    address public immutable faucet;

    error OnlyFaucet();

    modifier onlyFaucet() {
        if (msg.sender != faucet) revert OnlyFaucet();
        _;
    }

    /**
     * @notice Constructs the MockToken
     * @param name_ Token name
     * @param symbol_ Token symbol
     * @param decimals_ Number of decimals
     * @param faucet_ Faucet contract address (only address that can mint)
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        address faucet_
    ) ERC20(name_, symbol_) {
        _decimals = decimals_;
        faucet = faucet_;
    }

    /**
     * @notice Returns the number of decimals for this token
     * @return The number of decimals
     */
    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    /**
     * @notice Mints tokens to a specified address
     * @dev Only callable by the faucet contract
     * @param to Recipient address
     * @param amount Amount to mint
     */
    function mint(address to, uint256 amount) external onlyFaucet {
        _mint(to, amount);
    }

    /**
     * @notice Burns tokens from caller's balance
     * @param amount Amount to burn
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
