import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import {
  Initialize, Swap as SwapEvent, ModifyLiquidity
} from '../generated/PoolManager/PoolManager';
import { Pool, Swap, Position, SwapHourData } from '../generated/schema';
import {
  ZERO_BD, ZERO_BI, ONE_BI, getOrCreateProtocol,
  getOrCreateToken, getHourStartUnix, bigIntToBigDecimal
} from './helpers';

export function handleInitialize(event: Initialize): void {
  let pool      = new Pool(event.params.id);
  let token0    = getOrCreateToken(event.params.currency0);
  let token1    = getOrCreateToken(event.params.currency1);

  pool.token0    = token0.id;
  pool.token1    = token1.id;
  pool.feeTier   = BigInt.fromI32(event.params.fee);
  pool.hooks     = event.params.hooks;
  pool.liquidity = ZERO_BI;
  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.tick      = event.params.tick;
  pool.tvlUSD    = ZERO_BD;
  pool.volumeUSD = ZERO_BD;
  pool.feesUSD   = ZERO_BD;
  pool.txCount   = ZERO_BI;
  pool.createdAt = event.block.timestamp;
  pool.save();

  let protocol   = getOrCreateProtocol();
  protocol.totalPools = protocol.totalPools.plus(ONE_BI);
  protocol.save();
}

export function handleSwap(event: SwapEvent): void {
  let pool = Pool.load(event.params.id);
  if (pool === null) return;

  let amount0 = bigIntToBigDecimal(event.params.amount0, 18);
  let amount1 = bigIntToBigDecimal(event.params.amount1, 18);
  let amountUSD = amount0.abs().plus(amount1.abs());

  pool.volumeUSD = pool.volumeUSD.plus(amountUSD);
  pool.txCount   = pool.txCount.plus(ONE_BI);
  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.tick      = event.params.tick;
  pool.save();

  let hourStart = getHourStartUnix(event.block.timestamp);
  let hourId    = pool.id.toHex() + '-' + hourStart.toString();
  let hourData  = SwapHourData.load(hourId);
  if (hourData === null) {
    hourData = new SwapHourData(hourId);
    hourData.pool          = pool.id;
    hourData.hourStartUnix = hourStart;
    hourData.volumeUSD     = ZERO_BD;
    hourData.volumeToken0  = ZERO_BD;
    hourData.volumeToken1  = ZERO_BD;
    hourData.txCount       = ZERO_BI;
  }
  hourData.volumeUSD    = hourData.volumeUSD.plus(amountUSD);
  hourData.volumeToken0 = hourData.volumeToken0.plus(amount0.abs());
  hourData.volumeToken1 = hourData.volumeToken1.plus(amount1.abs());
  hourData.txCount      = hourData.txCount.plus(ONE_BI);
  hourData.save();

  let swapId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let swap   = new Swap(swapId);
  swap.pool        = pool.id;
  swap.sender      = event.params.sender;
  swap.recipient   = event.params.sender;
  swap.amount0     = amount0;
  swap.amount1     = amount1;
  swap.amountUSD   = amountUSD;
  swap.sqrtPriceX96 = event.params.sqrtPriceX96;
  swap.tick        = event.params.tick;
  swap.timestamp   = event.block.timestamp;
  swap.blockNumber = event.block.number;
  swap.txHash      = event.transaction.hash;
  swap.save();

  let protocol = getOrCreateProtocol();
  protocol.totalVolumeUSD = protocol.totalVolumeUSD.plus(amountUSD);
  protocol.totalSwaps     = protocol.totalSwaps.plus(ONE_BI);
  protocol.updatedAt      = event.block.timestamp;
  protocol.save();
}

export function handleModifyLiquidity(event: ModifyLiquidity): void {
  let pool = Pool.load(event.params.id);
  if (pool === null) return;

  let posId  = event.params.id.concat(
    Bytes.fromByteArray(Bytes.fromBigInt(
      BigInt.fromI32(event.params.tickLower)
        .plus(BigInt.fromI32(event.params.tickUpper))
    ))
  );
  let position = Position.load(posId);
  if (position === null) {
    position = new Position(posId);
    position.owner             = event.params.sender;
    position.pool              = pool.id;
    position.tickLower         = event.params.tickLower;
    position.tickUpper         = event.params.tickUpper;
    position.liquidity         = ZERO_BI;
    position.depositedToken0   = ZERO_BD;
    position.depositedToken1   = ZERO_BD;
    position.withdrawnToken0   = ZERO_BD;
    position.withdrawnToken1   = ZERO_BD;
    position.collectedFeesToken0 = ZERO_BD;
    position.collectedFeesToken1 = ZERO_BD;
    position.createdAt         = event.block.timestamp;
    position.transaction       = event.transaction.hash;
  }
  let liquidityDelta = event.params.liquidityDelta;
  if (liquidityDelta.gt(ZERO_BI)) {
    position.liquidity = position.liquidity.plus(liquidityDelta);
  } else {
    let abs = liquidityDelta.abs();
    position.liquidity = position.liquidity.gt(abs)
      ? position.liquidity.minus(abs)
      : ZERO_BI;
  }
  position.save();
}
