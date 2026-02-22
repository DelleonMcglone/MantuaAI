// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPoolManager {
    function unlock(bytes calldata data) external returns (bytes memory);
    function modifyLiquidity(
        PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes calldata hookData
    ) external returns (int256 callerDelta, int256 feesAccrued);
    function settle() external payable returns (uint256);
    function sync(address currency) external;
    function take(address currency, address to, uint256 amount) external;
}

struct PoolKey {
    address currency0;
    address currency1;
    uint24 fee;
    int24 tickSpacing;
    address hooks;
}

struct ModifyLiquidityParams {
    int24 tickLower;
    int24 tickUpper;
    int256 liquidityDelta;
    bytes32 salt;
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract MinimalLiquidityHelper {
    IPoolManager public immutable manager;

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    struct CallbackData {
        address sender;
        PoolKey key;
        ModifyLiquidityParams params;
    }

    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata
    ) external payable returns (int256) {
        bytes memory result = manager.unlock(
            abi.encode(CallbackData(msg.sender, key, params))
        );
        return abi.decode(result, (int256));
    }

    function unlockCallback(bytes calldata rawData) external returns (bytes memory) {
        require(msg.sender == address(manager), "Not manager");
        CallbackData memory data = abi.decode(rawData, (CallbackData));

        (int256 callerDelta, ) = manager.modifyLiquidity(
            data.key,
            data.params,
            ""
        );

        int128 amount0 = int128(callerDelta >> 128);
        int128 amount1 = int128(callerDelta);

        if (amount0 < 0) {
            manager.sync(data.key.currency0);
            IERC20(data.key.currency0).transferFrom(
                data.sender,
                address(manager),
                uint256(uint128(-amount0))
            );
            manager.settle();
        }
        if (amount1 < 0) {
            manager.sync(data.key.currency1);
            IERC20(data.key.currency1).transferFrom(
                data.sender,
                address(manager),
                uint256(uint128(-amount1))
            );
            manager.settle();
        }

        if (amount0 > 0) {
            manager.take(data.key.currency0, data.sender, uint256(uint128(amount0)));
        }
        if (amount1 > 0) {
            manager.take(data.key.currency1, data.sender, uint256(uint128(amount1)));
        }

        return abi.encode(callerDelta);
    }
}
