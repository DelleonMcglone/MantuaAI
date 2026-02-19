import { BigDecimal, BigInt, Bytes, Address } from '@graphprotocol/graph-ts';
import { Protocol, Token } from '../generated/schema';
import { ERC20 } from '../generated/PoolManager/ERC20';

export const ZERO_BD  = BigDecimal.fromString('0');
export const ONE_BD   = BigDecimal.fromString('1');
export const ZERO_BI  = BigInt.fromI32(0);
export const ONE_BI   = BigInt.fromI32(1);

export function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load('global');
  if (protocol === null) {
    protocol = new Protocol('global');
    protocol.totalVolumeUSD     = ZERO_BD;
    protocol.totalFeesUSD       = ZERO_BD;
    protocol.totalTvlUSD        = ZERO_BD;
    protocol.totalSwaps         = ZERO_BI;
    protocol.totalPools         = ZERO_BI;
    protocol.totalVaultDeposits = ZERO_BD;
    protocol.totalBetsUSD       = ZERO_BD;
    protocol.updatedAt          = ZERO_BI;
    protocol.save();
  }
  return protocol as Protocol;
}

export function getOrCreateToken(address: Address): Token {
  let token = Token.load(address);
  if (token === null) {
    token = new Token(address);
    let contract = ERC20.bind(address);
    let symbolResult = contract.try_symbol();
    let nameResult   = contract.try_name();
    let decimalsResult = contract.try_decimals();
    token.symbol   = symbolResult.reverted   ? 'UNKNOWN' : symbolResult.value;
    token.name     = nameResult.reverted     ? 'Unknown' : nameResult.value;
    token.decimals = decimalsResult.reverted ? 18        : decimalsResult.value;
    token.derivedETH          = ZERO_BD;
    token.totalValueLocked    = ZERO_BD;
    token.volume              = ZERO_BD;
    token.txCount             = ZERO_BI;
    token.save();
  }
  return token as Token;
}

export function getDayStartUnix(timestamp: BigInt): BigInt {
  let dayIndex = timestamp.toI32() / 86400;
  return BigInt.fromI32(dayIndex * 86400);
}

export function getHourStartUnix(timestamp: BigInt): BigInt {
  let hourIndex = timestamp.toI32() / 3600;
  return BigInt.fromI32(hourIndex * 3600);
}

export function bigIntToBigDecimal(value: BigInt, decimals: i32): BigDecimal {
  let bd = value.toBigDecimal();
  let divisor = BigDecimal.fromString('1' + '0'.repeat(decimals));
  return bd.div(divisor);
}
