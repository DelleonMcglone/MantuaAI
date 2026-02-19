import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import {
  MarketCreated, SharesBought,
  MarketResolved, WinningsClaimed
} from '../generated/MantuaPredictionMarket/MantuaPredictionMarket';
import {
  PredictionMarket, PredictionBet, PredictionClaim
} from '../generated/schema';
import { ZERO_BD, ZERO_BI, getOrCreateProtocol, bigIntToBigDecimal } from './helpers';

export function handleMarketCreated(event: MarketCreated): void {
  let market = new PredictionMarket(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.marketId))
  );
  market.contractId      = event.params.marketId;
  market.question        = event.params.question;
  market.category        = event.params.category;
  market.endTime         = event.params.endTime;
  market.resolved        = false;
  market.outcome         = null;
  market.totalYesShares  = ZERO_BD;
  market.totalNoShares   = ZERO_BD;
  market.createdAt       = event.block.timestamp;
  market.save();
}

export function handleSharesBought(event: SharesBought): void {
  let market = PredictionMarket.load(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.marketId))
  );
  if (market === null) return;

  let amount = bigIntToBigDecimal(event.params.amount, 6);

  if (event.params.isYes) {
    market.totalYesShares = market.totalYesShares.plus(amount);
  } else {
    market.totalNoShares = market.totalNoShares.plus(amount);
  }
  market.save();

  let betId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let bet   = new PredictionBet(betId);
  bet.market    = market.id;
  bet.user      = event.params.user;
  bet.isYes     = event.params.isYes;
  bet.amount    = amount;
  bet.shares    = bigIntToBigDecimal(event.params.shares, 6);
  bet.timestamp = event.block.timestamp;
  bet.txHash    = event.transaction.hash;
  bet.save();

  let protocol = getOrCreateProtocol();
  protocol.totalBetsUSD = protocol.totalBetsUSD.plus(amount);
  protocol.updatedAt    = event.block.timestamp;
  protocol.save();
}

export function handleMarketResolved(event: MarketResolved): void {
  let market = PredictionMarket.load(
    Bytes.fromByteArray(Bytes.fromBigInt(event.params.marketId))
  );
  if (market === null) return;
  market.resolved = true;
  market.outcome  = event.params.outcome;
  market.save();
}

export function handleWinningsClaimed(event: WinningsClaimed): void {
  let claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
  let claim   = new PredictionClaim(claimId);
  claim.market    = Bytes.fromByteArray(
    Bytes.fromBigInt(event.params.marketId)
  );
  claim.user      = event.params.user;
  claim.payout    = bigIntToBigDecimal(event.params.payout, 6);
  claim.timestamp = event.block.timestamp;
  claim.txHash    = event.transaction.hash;
  claim.save();
}
