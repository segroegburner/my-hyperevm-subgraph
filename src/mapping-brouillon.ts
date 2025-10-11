// // a ajouter au fichier mapping.ts
// // pour calculer le Utilization Rate et le Health Factor

// import { BigInt, BigDecimal } from "@graphprotocol/graph-ts";
// import {
//   Supply,
//   Withdraw,
//   Borrow,
//   Repay,
//   LiquidationCall,
//   ReserveDataUpdated,
//   ReserveUsedAsCollateralEnabled,
//   ReserveUsedAsCollateralDisabled
// } from "../generated/Pool/PoolInstance";

// import { PoolInstance } from "../generated/Pool/PoolInstance";
// import { Reserve, User } from "../generated/schema";

// // ---------- Helpers ----------

// // Convert BigInt -> BigDecimal avec 18 décimales
// function toDecimal(value: BigInt, decimals: i32 = 18): BigDecimal {
//   let scale = BigInt.fromI32(10).pow(<u8>decimals).toBigDecimal();
//   return value.toBigDecimal().div(scale);
// }

// // Recalcule le Utilization Rate pour une réserve
// function updateReserveUtilizationRate(asset: string, poolAddr: string): void {
//   let pool = PoolInstance.bind(Address.fromString(poolAddr));
//   let reserveData = pool.getReserveData(Address.fromString(asset));

//   let availableLiquidity = reserveData.value0; // dispo
//   let totalStableDebt = reserveData.value1;   // deprecated mais encore présent
//   let totalVariableDebt = reserveData.value2;

//   let totalDebt = totalStableDebt.plus(totalVariableDebt);

//   let ur = BigDecimal.zero();
//   if (!totalDebt.isZero()) {
//     ur = toDecimal(totalDebt).div(
//       toDecimal(totalDebt.plus(availableLiquidity))
//     );
//   }

//   let reserve = Reserve.load(asset);
//   if (reserve == null) {
//     reserve = new Reserve(asset);
//   }
//   reserve.utilizationRate = ur;
//   reserve.save();
// }

// // Recalcule le Health Factor pour un user
// function updateUserHealthFactor(userAddr: string, poolAddr: string): void {
//   let pool = PoolInstance.bind(Address.fromString(poolAddr));
//   let accountData = pool.getUserAccountData(Address.fromString(userAddr));

//   // getUserAccountData retourne 6 valeurs :
//   // (totalCollateralBase, totalDebtBase, availableBorrowsBase,
//   //  currentLiquidationThreshold, ltv, healthFactor)

//   let hfRaw = accountData.value5; // healthFactor en wei (18 décimales)
//   let hf = toDecimal(hfRaw, 18);

//   let user = User.load(userAddr);
//   if (user == null) {
//     user = new User(userAddr);
//   }
//   user.healthFactor = hf;
//   user.save();
// }

// // ---------- Event Handlers ----------

// export function handleSupply(event: Supply): void {
//   let asset = event.params.reserve.toHexString();
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(asset, poolAddr);
//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleWithdraw(event: Withdraw): void {
//   let asset = event.params.reserve.toHexString();
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(asset, poolAddr);
//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleBorrow(event: Borrow): void {
//   let asset = event.params.reserve.toHexString();
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(asset, poolAddr);
//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleRepay(event: Repay): void {
//   let asset = event.params.reserve.toHexString();
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(asset, poolAddr);
//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleLiquidationCall(event: LiquidationCall): void {
//   let collateralAsset = event.params.collateralAsset.toHexString();
//   let debtAsset = event.params.debtAsset.toHexString();
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(collateralAsset, poolAddr);
//   updateReserveUtilizationRate(debtAsset, poolAddr);
//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleReserveDataUpdated(event: ReserveDataUpdated): void {
//   let asset = event.params.reserve.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateReserveUtilizationRate(asset, poolAddr);
// }

// export function handleReserveUsedAsCollateralEnabled(
//   event: ReserveUsedAsCollateralEnabled
// ): void {
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateUserHealthFactor(user, poolAddr);
// }

// export function handleReserveUsedAsCollateralDisabled(
//   event: ReserveUsedAsCollateralDisabled
// ): void {
//   let user = event.params.user.toHexString();
//   let poolAddr = event.address.toHexString();

//   updateUserHealthFactor(user, poolAddr);
// }
