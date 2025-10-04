import { BigInt, Address, Bytes } from "@graphprotocol/graph-ts";
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
  Protocol
} from "../generated/schema";
import { ATokenInstance } from "../generated/Pool/ATokenInstance";

// Constants
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ZERO_BI = BigInt.fromI32(0);

// Helpers
function getOrCreateReserve(asset: Address): Reserve {
  let reserve = Reserve.load(asset.toHexString());
  if (!reserve) {
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

// Event Handlers

export function handleSupply(event: Supply): void {
  let reserve = getOrCreateReserve(event.params.reserve);
  let user = getOrCreateUser(event.params.user);
  let userReserve = getOrCreateUserReserve(event.params.user, event.params.reserve);

  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let supply = new SupplyEvent(id);
  supply.user = user.id;
  supply.reserve = reserve.id;
  supply.onBehalfOf = event.params.onBehalfOf;
  supply.amount = event.params.amount;
  // supply.referral = event.params.referral;
  supply.timestamp = event.block.timestamp;
  supply.txHash = event.transaction.hash;
  supply.save();

  // let aTokenContract = ATokenInstance.bind(reserve.aTokenAddress);
  let aTokenContract = ATokenInstance.bind(
  Address.fromBytes(reserve.aTokenAddress)
);

  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.currentATokenBalance = balanceResult.value;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
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

  // let aTokenContract = ATokenInstance.bind(reserve.aTokenAddress);
  let aTokenContract = ATokenInstance.bind(
  Address.fromBytes(reserve.aTokenAddress)
);

  let balanceResult = aTokenContract.try_balanceOf(event.params.user);
  if (!balanceResult.reverted) {
    userReserve.currentATokenBalance = balanceResult.value;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
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
  borrow.borrowRateMode = event.params.interestRateMode;
  borrow.borrowRate = event.params.borrowRate;
  // borrow.referral = event.params.referral;
  borrow.timestamp = event.block.timestamp;
  borrow.txHash = event.transaction.hash;
  borrow.save();

  userReserve.currentVariableDebt = userReserve.currentVariableDebt.plus(event.params.amount);
  userReserve.lastUpdateTimestamp = event.block.timestamp;
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

  if (userReserve.currentVariableDebt.gt(event.params.amount)) {
    userReserve.currentVariableDebt = userReserve.currentVariableDebt.minus(event.params.amount);
  } else {
    userReserve.currentVariableDebt = ZERO_BI;
  }
  userReserve.lastUpdateTimestamp = event.block.timestamp;
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
