import { ethers } from "ethers";

// Connect to HyperEVM testnet RPC
const provider = new ethers.JsonRpcProvider("https://rpc.hyperliquid-testnet.xyz/evm");

const main = async () => {
  const blockNumber = await provider.getBlockNumber();

  const block = await provider.getBlock(blockNumber);
  console.log("Block data:", block);

  console.log('##### Latest Block Number #####');

  console.log("Latest block number:", blockNumber);
};

main();
