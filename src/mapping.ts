import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  Supply,
  Withdraw,
  Borrow,
  Repay,
  LiquidationCall,
  ReserveDataUpdated,
} from "../generated/Pool/PoolInstance"
import { User, Asset, UserAsset, LogEvent } from "../generated/schema"

// --- Helpers ---

function zero(): BigInt {
  return BigInt.fromI32(0)
}

function oneRay(): BigInt {
  return BigInt.fromString("1000000000000000000000000000") // 1e27 (Aave Ray)
}

function getOrCreateUser(address: Address): User {
  let id = address.toHexString()
  let user = User.load(id)
  if (!user) {
    user = new User(id)
    user.totalSuppliedUSD = zero()
    user.totalBorrowedUSD = zero()
    user.totalCollateralUSD = zero()
    user.points = 0
    user.referralPoints = 0
    user.referralCount = 0
    user.eModeActivated = false
    user.save()
  }
  return user
}

function getOrCreateAsset(address: Address, symbol: string = "ASSET"): Asset {
  let id = address.toHexString()
  let asset = Asset.load(id)
  if (!asset) {
    asset = new Asset(id)
    asset.symbol = symbol
    asset.name = symbol
    asset.decimals = 18
    asset.type = "POOLED"
    asset.priceUSD = zero()
    asset.totalSupplied = zero()
    asset.totalBorrowed = zero()
    asset.liquidityIndex = oneRay()
    asset.variableBorrowIndex = oneRay()
    asset.aTokenAddress = address // par défaut
    asset.variableDebtTokenAddress = address // par défaut
    asset.save()
  }
  return asset
}

function getOrCreateUserAsset(user: User, asset: Asset): UserAsset {
  let id = user.id + "-" + asset.id
  let ua = UserAsset.load(id)
  if (!ua) {
    ua = new UserAsset(id)
    ua.user = user.id
    ua.asset = asset.id
    ua.depositedAmount = zero()
    ua.borrowedAmount = zero()
    ua.depositedUSD = zero()
    ua.borrowedUSD = zero()
    ua.currentBalance = zero()
    ua.currentDebt = zero()
    ua.lastLiquidityIndex = asset.liquidityIndex
    ua.lastVariableBorrowIndex = asset.variableBorrowIndex
    ua.usageAsCollateralEnabled = true
    ua.save()
  }
  return ua
}

// --- Handlers ---

export function handleSupply(event: Supply): void {
  let user = getOrCreateUser(event.params.user)
  let asset = getOrCreateAsset(event.params.reserve)
  let ua = getOrCreateUserAsset(user, asset)

  // Met à jour le currentBalance selon le nouvel index
  ua.currentBalance = ua.currentBalance
    .times(asset.liquidityIndex)
    .div(ua.lastLiquidityIndex)
    .plus(event.params.amount)

  ua.depositedAmount = ua.depositedAmount.plus(event.params.amount)
  ua.depositedUSD = ua.depositedUSD.plus(event.params.amount)
  ua.lastLiquidityIndex = asset.liquidityIndex
  ua.save()

  user.totalSuppliedUSD = user.totalSuppliedUSD.plus(event.params.amount)
  user.points += event.params.amount.toI32() / 1e18
  user.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new LogEvent(id)
  evt.type = "SUPPLY"
  evt.user = user.id
  evt.assetRel = asset.id
  evt.amount = event.params.amount
  evt.timestamp = event.block.timestamp
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleWithdraw(event: Withdraw): void {
  let user = getOrCreateUser(event.params.user)
  let asset = getOrCreateAsset(event.params.reserve)
  let ua = getOrCreateUserAsset(user, asset)

  ua.currentBalance = ua.currentBalance
    .times(asset.liquidityIndex)
    .div(ua.lastLiquidityIndex)
    .minus(event.params.amount)

  ua.depositedAmount = ua.depositedAmount.minus(event.params.amount)
  ua.depositedUSD = ua.depositedUSD.minus(event.params.amount)
  ua.lastLiquidityIndex = asset.liquidityIndex
  ua.save()

  user.totalSuppliedUSD = user.totalSuppliedUSD.minus(event.params.amount)
  user.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new LogEvent(id)
  evt.type = "WITHDRAW"
  evt.user = user.id
  evt.assetRel = asset.id
  evt.amount = event.params.amount
  evt.timestamp = event.block.timestamp
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleBorrow(event: Borrow): void {
  let user = getOrCreateUser(event.params.user)
  let asset = getOrCreateAsset(event.params.reserve)
  let ua = getOrCreateUserAsset(user, asset)

  ua.currentDebt = ua.currentDebt
    .times(asset.variableBorrowIndex)
    .div(ua.lastVariableBorrowIndex)
    .plus(event.params.amount)

  ua.borrowedAmount = ua.borrowedAmount.plus(event.params.amount)
  ua.borrowedUSD = ua.borrowedUSD.plus(event.params.amount)
  ua.lastVariableBorrowIndex = asset.variableBorrowIndex
  ua.save()

  user.totalBorrowedUSD = user.totalBorrowedUSD.plus(event.params.amount)
  user.points += event.params.amount.toI32() / 2e18
  user.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new LogEvent(id)
  evt.type = "BORROW"
  evt.user = user.id
  evt.assetRel = asset.id
  evt.amount = event.params.amount
  evt.borrowRateMode = BigInt.fromI32(event.params.interestRateMode)
  evt.borrowRate = event.params.borrowRate
  evt.timestamp = event.block.timestamp
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleRepay(event: Repay): void {
  let user = getOrCreateUser(event.params.user)
  let asset = getOrCreateAsset(event.params.reserve)
  let ua = getOrCreateUserAsset(user, asset)

  ua.currentDebt = ua.currentDebt
    .times(asset.variableBorrowIndex)
    .div(ua.lastVariableBorrowIndex)
    .minus(event.params.amount)

  ua.borrowedAmount = ua.borrowedAmount.minus(event.params.amount)
  ua.borrowedUSD = ua.borrowedUSD.minus(event.params.amount)
  ua.lastVariableBorrowIndex = asset.variableBorrowIndex
  ua.save()

  user.totalBorrowedUSD = user.totalBorrowedUSD.minus(event.params.amount)
  user.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new LogEvent(id)
  evt.type = "REPAY"
  evt.user = user.id
  evt.assetRel = asset.id
  evt.amount = event.params.amount
  evt.repayer = event.params.repayer
  evt.useATokens = event.params.useATokens
  evt.timestamp = event.block.timestamp
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleLiquidationCall(event: LiquidationCall): void {
  let user = getOrCreateUser(event.params.user)
  let collateral = getOrCreateAsset(event.params.collateralAsset)
  let debt = getOrCreateAsset(event.params.debtAsset)
  let ua = getOrCreateUserAsset(user, debt)

  ua.borrowedAmount = ua.borrowedAmount.minus(event.params.debtToCover)
  ua.borrowedUSD = ua.borrowedUSD.minus(event.params.debtToCover)
  ua.save()

  user.totalBorrowedUSD = user.totalBorrowedUSD.minus(event.params.debtToCover)
  user.save()

  let id = event.transaction.hash.toHex() + "-" + event.logIndex.toString()
  let evt = new LogEvent(id)
  evt.type = "LIQUIDATION"
  evt.user = user.id
  evt.assetRel = debt.id
  evt.amount = event.params.debtToCover
  evt.collateralAsset = collateral.id as Bytes
  evt.debtToCover = event.params.debtToCover
  evt.liquidatedCollateralAmount = event.params.liquidatedCollateralAmount
  evt.liquidator = event.params.liquidator
  evt.receiveAToken = event.params.receiveAToken
  evt.timestamp = event.block.timestamp
  evt.txHash = event.transaction.hash
  evt.save()
}

export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
  let reserveId = event.params.reserve.toHexString()
  let asset = Asset.load(reserveId)

  if (!asset) {
    // ⚠️ Si l'asset n'existe pas encore, on peut le créer minimalement ici.
    asset = new Asset(reserveId)
    asset.symbol = "UNKNOWN"
    asset.name = "Unknown Asset"
    asset.decimals = 18
    asset.type = "POOLED"
    asset.priceUSD = BigInt.fromI32(0)
    asset.marketSizeUSD = BigInt.fromI32(0)
    asset.availableLiquidity = BigInt.fromI32(0)
    asset.totalLiquidity = BigInt.fromI32(0)
    asset.totalSupplied = BigInt.fromI32(0)
    asset.totalBorrowed = BigInt.fromI32(0)
    asset.utilizationRate = BigInt.fromI32(0)
    asset.supplyAPY = BigInt.fromI32(0)
    asset.borrowAPY = BigInt.fromI32(0)
    asset.liquidityRate = BigInt.fromI32(0)
    asset.variableBorrowRate = BigInt.fromI32(0)
    asset.ltv = BigInt.fromI32(0)
    asset.liquidationThreshold = BigInt.fromI32(0)
    asset.liquidationBonus = BigInt.fromI32(0)
    asset.reserveFactor = BigInt.fromI32(0)
    asset.liquidationPenalty = BigInt.fromI32(0)
    asset.isActive = true
    asset.isFrozen = false
    asset.borrowingEnabled = true
    asset.usageAsCollateralEnabled = true
    asset.aTokenAddress = event.params.aToken
    asset.variableDebtTokenAddress = event.params.variableDebtToken
    asset.liquidityIndex = BigInt.fromI32(0)
    asset.variableBorrowIndex = BigInt.fromI32(0)
    asset.lastUpdateTimestamp = event.block.timestamp
  }

  // --- Mise à jour des données du marché ---
  asset.liquidityRate = event.params.liquidityRate
  asset.variableBorrowRate = event.params.variableBorrowRate
  asset.liquidityIndex = event.params.liquidityIndex
  asset.variableBorrowIndex = event.params.variableBorrowIndex
  asset.lastUpdateTimestamp = event.block.timestamp

  // Optionnel : calcul du taux d’utilisation (utile pour les graphiques)
  if (asset.totalSupplied.gt(BigInt.fromI32(0))) {
    asset.utilizationRate = asset.totalBorrowed.times(BigInt.fromI32(1e18)).div(asset.totalSupplied)
  }

  asset.save()
}