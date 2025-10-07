// src/mapping.ts
import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  Supply,
  Withdraw,
  Borrow,
  Repay,
  LiquidationCall
} from "../generated/Pool/PoolInstance";
import {
  Reserve,
  User,
  UserReserve,
  SupplyEvent,
  WithdrawEvent,
  BorrowEvent,
  RepayEvent,
  LiquidationEvent,
  Protocol,
  Market
} from "../generated/schema";
import { ATokenInstance } from "../generated/Pool/ATokenInstance";

// Constants
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BI = BigInt.fromI32(0);

// --- Helpers pour Market ---
function getOrCreateMarket(): Market {
  let id = "pooled"; // id par défaut — adapte si tu veux d'autres marchés
  let market = Market.load(id);
  if (!market) {
    market = new Market(id);
    market.name = "Pooled";
    market.description = "";
    market.marketSizeUSD = ZERO_BI;
    market.feesPaidUSD = ZERO_BI;
    market.sLPLocked = ZERO_BI;
    market.sSWIMPriceUSD = ZERO_BI;
    market.maxAPRLockedSLP = ZERO_BI;
    market.save();
  }
  return market;
}

// --- Reserve ---
function getOrCreateReserve(asset: Address): Reserve {
  let id = asset.toHexString();
  let reserve = Reserve.load(id);

  if (!reserve) {
    reserve = new Reserve(id);

    // champs obligatoires (init)
    reserve.symbol = "";
    reserve.name = "";
    reserve.decimals = 18;

    reserve.priceUSD = ZERO_BI;
    reserve.marketSizeUSD = ZERO_BI;
    reserve.availableLiquidity = ZERO_BI;
    reserve.totalLiquidity = ZERO_BI;
    reserve.totalSupplied = ZERO_BI;
    reserve.totalBorrowed = ZERO_BI;
    reserve.utilizationRate = ZERO_BI;

    // associe au market par défaut (évite l'erreur "missing value for non-nullable field `market`")
    let market = getOrCreateMarket();
    reserve.market = market.id;

    // rates
    reserve.supplyAPY = ZERO_BI;
    reserve.borrowAPY = ZERO_BI;
    reserve.liquidityRate = ZERO_BI;
    reserve.variableBorrowRate = ZERO_BI;
    reserve.liquidityIndex = ZERO_BI;
    reserve.variableBorrowIndex = ZERO_BI;

    // collateral params
    reserve.ltv = ZERO_BI;
    reserve.liquidationThreshold = ZERO_BI;
    reserve.liquidationBonus = ZERO_BI;
    reserve.reserveFactor = ZERO_BI;
    reserve.liquidationPenalty = ZERO_BI;

    // status
    reserve.isActive = false;
    reserve.isFrozen = false;
    reserve.borrowingEnabled = false;
    reserve.usageAsCollateralEnabled = false;

    // tokens (Bytes non-nullable)
    reserve.aTokenAddress = Bytes.fromHexString(ZERO_ADDRESS);
    reserve.variableDebtTokenAddress = Bytes.fromHexString(ZERO_ADDRESS);

    reserve.save();
    return reserve;
  }

  // Si la reserve existe mais éventuellement sans market (conséquence d'un ancien déploiement),
  // on tente de corriger en écrasant avec le market par défaut.
  // ATTENTION : si l'entité existante est partiellement corrompue, la meilleure option reste un reindex.
  if (!reserve.market || reserve.market == "") {
    let market = getOrCreateMarket();
    reserve.market = market.id;
    reserve.save();
  }

  return reserve;
}

// --- User / UserReserve / Protocol ---
function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  if (!user) {
    user = new User(address.toHexString());
    user.totalSuppliedUSD = ZERO_BI;
    user.totalBorrowedUSD = ZERO_BI;
    user.totalCollateralUSD = ZERO_BI;
    user.healthFactor = ZERO_BI;
    user.save();

    let protocol = getOrCreateProtocol();
    protocol.totalUsers += 1;
    protocol.save();
  }
  return user;
}

function getOrCreateUserReserve(userAddress: Address, reserveAddress: Address): UserReserve {
  let id = userAddress.toHexString() + "-" + reserveAddress.toHexString();
  let userReserve = UserReserve.load(id);
  if (!userReserve) {
    userReserve = new UserReserve(id);
    userReserve.user = userAddress.toHexString();
    userReserve.reserve = reserveAddress.toHexString();

    // champs obligatoires (init)
    userReserve.depositedAmount = ZERO_BI;
    userReserve.borrowedAmount = ZERO_BI;
    userReserve.depositedUSD = ZERO_BI;
    userReserve.borrowedUSD = ZERO_BI;

    userReserve.usageAsCollateralEnabled = false;
    // eModeCategory est optionnel → laisser non défini si pas connu
    // userReserve.eModeCategory = null; // ne pas forcer si non disponible

    userReserve.healthFactor = ZERO_BI;
    userReserve.liquidationThreshold = ZERO_BI;
    userReserve.ltv = ZERO_BI;

    userReserve.save();
  }
  return userReserve;
}

function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load("1");
  if (!protocol) {
    protocol = new Protocol("1");
    protocol.totalValueLockedUSD = ZERO_BI;
    protocol.totalBorrowedUSD = ZERO_BI;
    protocol.totalUsers = 0;
    protocol.totalSupplies = 0;
    protocol.totalBorrows = 0;
    protocol.totalRepays = 0;
    protocol.totalWithdraws = 0;
    protocol.totalLiquidations = 0;
    protocol.save();
  }
  return protocol;
}

// --- Logging helper pour déboguer le contenu d'une Reserve ---
function logReserve(reserve: Reserve): void {
  log.warning("==== Reserve dump: {} ====", [reserve.id]);
  log.warning("market: {}", [reserve.market]);
  log.warning("symbol: {}", [reserve.symbol]);
  log.warning("name: {}", [reserve.name]);
  log.warning("decimals: {}", [reserve.decimals.toString()]);
  log.warning("priceUSD: {}", [reserve.priceUSD.toString()]);
  log.warning("marketSizeUSD: {}", [reserve.marketSizeUSD.toString()]);
  log.warning("availableLiquidity: {}", [reserve.availableLiquidity.toString()]);
  log.warning("totalLiquidity: {}", [reserve.totalLiquidity.toString()]);
  log.warning("totalSupplied: {}", [reserve.totalSupplied.toString()]);
  log.warning("totalBorrowed: {}", [reserve.totalBorrowed.toString()]);
  log.warning("utilizationRate: {}", [reserve.utilizationRate.toString()]);

  log.warning("supplyAPY: {}", [reserve.supplyAPY.toString()]);
  log.warning("borrowAPY: {}", [reserve.borrowAPY.toString()]);
  log.warning("liquidityRate: {}", [reserve.liquidityRate.toString()]);
  log.warning("variableBorrowRate: {}", [reserve.variableBorrowRate.toString()]);
  log.warning("liquidityIndex: {}", [reserve.liquidityIndex.toString()]);
  log.warning("variableBorrowIndex: {}", [reserve.variableBorrowIndex.toString()]);

  log.warning("ltv: {}", [reserve.ltv.toString()]);
  log.warning("liquidationThreshold: {}", [reserve.liquidationThreshold.toString()]);
  log.warning("liquidationBonus: {}", [reserve.liquidationBonus.toString()]);
  log.warning("reserveFactor: {}", [reserve.reserveFactor.toString()]);
  log.warning("liquidationPenalty: {}", [reserve.liquidationPenalty.toString()]);

  log.warning("isActive: {}", [reserve.isActive ? "true" : "false"]);
  log.warning("isFrozen: {}", [reserve.isFrozen ? "true" : "false"]);
  log.warning("borrowingEnabled: {}", [reserve.borrowingEnabled ? "true" : "false"]);
  log.warning("usageAsCollateralEnabled: {}", [reserve.usageAsCollateralEnabled ? "true" : "false"]);

  log.warning("aTokenAddress: {}", [reserve.aTokenAddress.toHexString()]);
  log.warning("variableDebtTokenAddress: {}", [reserve.variableDebtTokenAddress.toHexString()]);
}

// --- Event handlers ---
export function handleSupply(event: Supply): void {
  log.warning("dans la fonction handleSupply", []);
  log.warning("l'utilisateur: {}", [event.params.user.toHexString()]);
  log.warning("event.params.reserve: {}", [event.params.reserve.toHexString()]);

  let reserve = getOrCreateReserve(event.params.reserve);
  // dump pour debugging (affiche tous les champs de reserve)
  logReserve(reserve);

  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let supply = new SupplyEvent(id);
  supply.user = user.id;
  supply.reserve = reserve.id;
  supply.onBehalfOf = event.params.onBehalfOf;
  supply.amount = event.params.amount;
  supply.referral = 0;
  supply.timestamp = event.block.timestamp;
  supply.txHash = event.transaction.hash;
  supply.save();

  // essayer de lire le balanceOf aToken pour mettre à jour depositedAmount
  let aTokenContract = ATokenInstance.bind(Address.fromBytes(reserve.aTokenAddress));
  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.depositedAmount = balanceResult.value;
  } else {
    // fallback si call revert -> incrémente approximativement
    userReserve.depositedAmount = userReserve.depositedAmount.plus(event.params.amount);
  }

  userReserve.save();

  let protocol = getOrCreateProtocol();
  protocol.totalSupplies += 1;
  protocol.save();
}

export function handleWithdraw(event: Withdraw): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdraw = new WithdrawEvent(id);
  withdraw.user = user.id;
  withdraw.reserve = reserve.id;
  withdraw.to = event.params.to;
  withdraw.amount = event.params.amount;
  withdraw.timestamp = event.block.timestamp;
  withdraw.txHash = event.transaction.hash;
  withdraw.save();

  let aTokenContract = ATokenInstance.bind(Address.fromBytes(reserve.aTokenAddress));
  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.depositedAmount = balanceResult.value;
  } else {
    if (userReserve.depositedAmount.gt(event.params.amount)) {
      userReserve.depositedAmount = userReserve.depositedAmount.minus(event.params.amount);
    } else {
      userReserve.depositedAmount = ZERO_BI;
    }
  }

  userReserve.save();

  let protocol = getOrCreateProtocol();
  protocol.totalWithdraws += 1;
  protocol.save();
}

export function handleBorrow(event: Borrow): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let borrow = new BorrowEvent(id);
  borrow.user = user.id;
  borrow.reserve = reserve.id;
  borrow.onBehalfOf = event.params.onBehalfOf;
  borrow.amount = event.params.amount;
  borrow.borrowRateMode = BigInt.fromI32(event.params.interestRateMode);
  borrow.borrowRate = event.params.borrowRate;
  borrow.timestamp = event.block.timestamp;
  borrow.txHash = event.transaction.hash;
  borrow.save();

  userReserve.borrowedAmount = userReserve.borrowedAmount.plus(event.params.amount);
  userReserve.save();

  let protocol = getOrCreateProtocol();
  protocol.totalBorrows += 1;
  protocol.save();
}

export function handleRepay(event: Repay): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let repay = new RepayEvent(id);
  repay.user = user.id;
  repay.reserve = reserve.id;
  repay.repayer = event.params.repayer;
  repay.amount = event.params.amount;
  repay.useATokens = event.params.useATokens;
  repay.timestamp = event.block.timestamp;
  repay.txHash = event.transaction.hash;
  repay.save();

  if (userReserve.borrowedAmount.gt(event.params.amount)) {
    userReserve.borrowedAmount = userReserve.borrowedAmount.minus(event.params.amount);
  } else {
    userReserve.borrowedAmount = ZERO_BI;
  }
  userReserve.save();

  let protocol = getOrCreateProtocol();
  protocol.totalRepays += 1;
  protocol.save();
}

export function handleLiquidationCall(event: LiquidationCall): void {
  let collateralReserve = getOrCreateReserve(event.params.collateralAsset);
  let debtReserve = getOrCreateReserve(event.params.debtAsset);
  let user = getOrCreateUser(event.params.user);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let liquidation = new LiquidationEvent(id);
  liquidation.user = user.id;
  liquidation.collateralReserve = collateralReserve.id;
  liquidation.debtReserve = debtReserve.id;
  liquidation.debtToCover = event.params.debtToCover;
  liquidation.liquidatedCollateralAmount = event.params.liquidatedCollateralAmount;
  liquidation.liquidator = event.params.liquidator;
  liquidation.receiveAToken = event.params.receiveAToken;
  liquidation.timestamp = event.block.timestamp;
  liquidation.txHash = event.transaction.hash;
  liquidation.save();

  let protocol = getOrCreateProtocol();
  protocol.totalLiquidations += 1;
  protocol.save();
}
