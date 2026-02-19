import { Address, BigInt, Bytes } from '@graphprotocol/graph-ts';
import { Deposit, Withdraw } from '../generated/MantuaVaultETHUSDC/MantuaVault';
import { Vault, VaultDeposit, VaultWithdrawal, VaultDayData } from '../generated/schema';
import { ZERO_BD, ZERO_BI, getOrCreateProtocol, getDayStartUnix, bigIntToBigDecimal } from './helpers';

function getOrCreateVault(address: Address): Vault {
  let vault = Vault.load(address);
  if (vault === null) {
    vault = new Vault(address);
    vault.name         = '';
    vault.symbol       = '';
    vault.asset        = address;
    vault.strategy     = 0;
    vault.totalAssets  = ZERO_BD;
    vault.totalShares  = ZERO_BD;
    vault.apyBps       = ZERO_BI;
    vault.save();
  }
  return vault as Vault;
}

function getOrCreateVaultDayData(vault: Vault, timestamp: BigInt): VaultDayData {
  let dayStart = getDayStartUnix(timestamp);
  let id = vault.id.toHex() + '-' + dayStart.toString();
  let dayData = VaultDayData.load(id);
  if (dayData === null) {
    dayData = new VaultDayData(id);
    dayData.vault             = vault.id;
    dayData.dayStartUnix      = dayStart;
    dayData.totalAssets       = vault.totalAssets;
    dayData.totalShares       = vault.totalShares;
    dayData.dailyDeposits     = ZERO_BD;
    dayData.dailyWithdrawals  = ZERO_BD;
    dayData.apyBps            = vault.apyBps;
    dayData.save();
  }
  return dayData as VaultDayData;
}

export function handleDeposit(event: Deposit): void {
  let vault    = getOrCreateVault(event.address);
  let protocol = getOrCreateProtocol();
  let assets   = bigIntToBigDecimal(event.params.assets, 18);
  let shares   = bigIntToBigDecimal(event.params.shares, 18);

  vault.totalAssets = vault.totalAssets.plus(assets);
  vault.totalShares = vault.totalShares.plus(shares);
  vault.save();

  let dayData = getOrCreateVaultDayData(vault, event.block.timestamp);
  dayData.totalAssets   = vault.totalAssets;
  dayData.totalShares   = vault.totalShares;
  dayData.dailyDeposits = dayData.dailyDeposits.plus(assets);
  dayData.save();

  let depositId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let deposit   = new VaultDeposit(depositId);
  deposit.vault       = vault.id;
  deposit.sender      = event.params.sender;
  deposit.owner       = event.params.owner;
  deposit.assets      = assets;
  deposit.shares      = shares;
  deposit.timestamp   = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.txHash      = event.transaction.hash;
  deposit.save();

  protocol.totalVaultDeposits = protocol.totalVaultDeposits.plus(assets);
  protocol.updatedAt          = event.block.timestamp;
  protocol.save();
}

export function handleWithdraw(event: Withdraw): void {
  let vault   = getOrCreateVault(event.address);
  let assets  = bigIntToBigDecimal(event.params.assets, 18);
  let shares  = bigIntToBigDecimal(event.params.shares, 18);

  vault.totalAssets = vault.totalAssets.minus(assets);
  vault.totalShares = vault.totalShares.minus(shares);
  vault.save();

  let dayData = getOrCreateVaultDayData(vault, event.block.timestamp);
  dayData.totalAssets      = vault.totalAssets;
  dayData.dailyWithdrawals = dayData.dailyWithdrawals.plus(assets);
  dayData.save();

  let withdrawId  = event.transaction.hash.concatI32(event.logIndex.toI32());
  let withdrawal  = new VaultWithdrawal(withdrawId);
  withdrawal.vault       = vault.id;
  withdrawal.sender      = event.params.sender;
  withdrawal.receiver    = event.params.receiver;
  withdrawal.owner       = event.params.owner;
  withdrawal.assets      = assets;
  withdrawal.shares      = shares;
  withdrawal.timestamp   = event.block.timestamp;
  withdrawal.txHash      = event.transaction.hash;
  withdrawal.save();
}
