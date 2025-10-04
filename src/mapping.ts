import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
import {
  Supply,
  Withdraw,
  Borrow,
  Repay,
  LiquidationCall,
  ReserveDataUpdated
} from "../generated/Pool/Pool";
import {
  AssetPriceUpdated
} from "../generated/AaveOracle/AaveOracle";
import {
  Reserve,
  User,
  UserReserve,
  SupplyEvent,
  WithdrawEvent,
  BorrowEvent,
  RepayEvent,
  LiquidationEvent,
  PriceUpdate,
  Protocol
} from "../generated/schema";
import { AToken } from "../generated/Pool/AToken";
import { Pool } from "../generated/Pool/Pool";

// Constants
const POOL_ADDRESS = "0xf4438C3554d0360ECDe4358232821354e71C59e9";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BI = BigInt.fromI32(0);
const ONE_BI = BigInt.fromI32(1);

// Helper functions
function getOrCreateReserve(asset: Address): Reserve {
  let reserve = Reserve.load(asset.toHexString());
  
  if (reserve == null) {
    reserve = new Reserve(asset.toHexString());
    reserve.symbol = "";
    reserve.name = "";
    reserve.decimals = 18;
    reserve.totalLiquidity = ZERO_BI;
    reserve.availableLiquidity = ZERO_BI;
    reserve.totalSupplied = ZERO_BI;
    reserve.totalBorrowed = ZERO_BI;
    reserve.totalBorrowedVariable = ZERO_BI;
    reserve.liquidityRate = ZERO_BI;
    reserve.variableBorrowRate = ZERO_BI;
    reserve.liquidityIndex = ZERO_BI;
    reserve.variableBorrowIndex = ZERO_BI;
    reserve.priceInUSD = ZERO_BI;
    reserve.lastUpdateTimestamp = ZERO_BI;
    reserve.ltv = ZERO_BI;
    reserve.liquidationThreshold = ZERO_BI;
    reserve.liquidationBonus = ZERO_BI;
    reserve.reserveFactor = ZERO_BI;
    reserve.isActive = false;
    reserve.isFrozen = false;
    reserve.borrowingEnabled = false;
    reserve.usageAsCollateralEnabled = false;
    reserve.aTokenAddress = Bytes.fromHexString(ZERO_ADDRESS);
    reserve.variableDebtTokenAddress = Bytes.fromHexString(ZERO_ADDRESS);
    reserve.save();
  }
  
  return reserve;
}

function getOrCreateUser(address: Address): User {
  let user = User.load(address.toHexString());
  
  if (user == null) {
    user = new User(address.toHexString());
    user.totalSuppliedUSD = ZERO_BI;
    user.totalBorrowedUSD = ZERO_BI;
    user.totalCollateralUSD = ZERO_BI;
    user.healthFactor = ZERO_BI;
    user.save();
    
    // Update protocol user count
    let protocol = getOrCreateProtocol();
    protocol.totalUsers = protocol.totalUsers + 1;
    protocol.save();
  }
  
  return user;
}

function getOrCreateUserReserve(userAddress: Address, reserveAddress: Address): UserReserve {
  let id = userAddress.toHexString() + "-" + reserveAddress.toHexString();
  let userReserve = UserReserve.load(id);
  
  if (userReserve == null) {
    userReserve = new UserReserve(id);
    userReserve.user = userAddress.toHexString();
    userReserve.reserve = reserveAddress.toHexString();
    userReserve.currentATokenBalance = ZERO_BI;
    userReserve.currentVariableDebt = ZERO_BI;
    userReserve.scaledATokenBalance = ZERO_BI;
    userReserve.scaledVariableDebt = ZERO_BI;
    userReserve.liquidityRate = ZERO_BI;
    userReserve.variableBorrowRate = ZERO_BI;
    userReserve.lastUpdateTimestamp = ZERO_BI;
    userReserve.usageAsCollateralEnabledOnUser = false;
    userReserve.save();
  }
  
  return userReserve;
}

function getOrCreateProtocol(): Protocol {
  let protocol = Protocol.load("1");
  
  if (protocol == null) {
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

// Event Handlers

export function handleSupply(event: Supply): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);
  
  // Create supply event
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let supply = new SupplyEvent(id);
  supply.user = user.id;
  supply.reserve = reserve.id;
  supply.onBehalfOf = event.params.onBehalfOf;
  supply.amount = event.params.amount;
  supply.referral = event.params.referral;
  supply.timestamp = event.block.timestamp;
  supply.txHash = event.transaction.hash;
  supply.save();
  
  // Update user reserve balance
  let aTokenContract = AToken.bind(Address.fromBytes(reserve.aTokenAddress));
  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.currentATokenBalance = balanceResult.value;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
  userReserve.save();
  
  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalSupplies = protocol.totalSupplies + 1;
  protocol.save();
}

export function handleWithdraw(event: Withdraw): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);
  
  // Create withdraw event
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdraw = new WithdrawEvent(id);
  withdraw.user = user.id;
  withdraw.reserve = reserve.id;
  withdraw.to = event.params.to;
  withdraw.amount = event.params.amount;
  withdraw.timestamp = event.block.timestamp;
  withdraw.txHash = event.transaction.hash;
  withdraw.save();
  
  // Update user reserve balance
  let aTokenContract = AToken.bind(Address.fromBytes(reserve.aTokenAddress));
  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.currentATokenBalance = balanceResult.value;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
  userReserve.save();
  
  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalWithdraws = protocol.totalWithdraws + 1;
  protocol.save();
}

export function handleBorrow(event: Borrow): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);
  
  // Create borrow event
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let borrow = new BorrowEvent(id);
  borrow.user = user.id;
  borrow.reserve = reserve.id;
  borrow.onBehalfOf = event.params.onBehalfOf;
  borrow.amount = event.params.amount;
  borrow.borrowRateMode = event.params.interestRateMode;
  borrow.borrowRate = event.params.borrowRate;
  borrow.referral = event.params.referral;
  borrow.timestamp = event.block.timestamp;
  borrow.txHash = event.transaction.hash;
  borrow.save();
  
  // Update user reserve debt
  userReserve.currentVariableDebt = userReserve.currentVariableDebt.plus(event.params.amount);
  userReserve.lastUpdateTimestamp = event.block.timestamp;
  userReserve.save();
  
  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalBorrows = protocol.totalBorrows + 1;
  protocol.save();
}

export function handleRepay(event: Repay): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);
  
  // Create repay event
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
  
  // Update user reserve debt
  if (userReserve.currentVariableDebt.gt(event.params.amount)) {
    userReserve.currentVariableDebt = userReserve.currentVariableDebt.minus(event.params.amount);
  } else {
    userReserve.currentVariableDebt = ZERO_BI;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
  userReserve.save();
  
  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalRepays = protocol.totalRepays + 1;
  protocol.save();
}

export function handleLiquidationCall(event: LiquidationCall): void {
  let collateralReserve = getOrCreateReserve(event.params.collateralAsset);
  let debtReserve = getOrCreateReserve(event.params.debtAsset);
  let user = getOrCreateUser(event.params.user);
  
  // Create liquidation event
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
  
  // Update protocol stats
  let protocol = getOrCreateProtocol();
  protocol.totalLiquidations = protocol.totalLiquidations + 1;
  protocol.save();
}

export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  
  reserve.liquidityRate = event.params.liquidityRate;
  reserve.variableBorrowRate = event.params.variableBorrowRate;
  reserve.liquidityIndex = event.params.liquidityIndex;
  reserve.variableBorrowIndex = event.params.variableBorrowIndex;
  reserve.lastUpdateTimestamp = event.block.timestamp;
  reserve.save();
}

export function handleAssetPriceUpdated(event: AssetPriceUpdated): void {
  let reserve = getOrCreateReserve(event.params.asset);
  
  reserve.priceInUSD = event.params.price;
  reserve.lastUpdateTimestamp = event.block.timestamp;
  reserve.save();
  
  // Create price update event
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let priceUpdate = new PriceUpdate(id);
  priceUpdate.asset = event.params.asset;
  priceUpdate.price = event.params.price;
  priceUpdate.timestamp = event.block.timestamp;
  priceUpdate.txHash = event.transaction.hash;
  priceUpdate.save();
}