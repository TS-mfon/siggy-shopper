import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.build' });

const privateKey = process.env['private key'];
const cleanKey = privateKey ? privateKey.trim() : '';
const account = createAccount(cleanKey as `0x${string}`);

const client = createClient({
  chain: studionet,
  account: account,
});

async function main() {
  const address = "0x494Ac07Af536a3d207DEb9C18e34a6A7884fe0bd";
  console.log("Reading from contract at address:", address);

  try {
    const recommendation = await client.readContract({
      address: address as `0x${string}`,
      functionName: 'get_recommendation',
      args: ["test_x5pnz"],
      transactionHashVariant: 'latest-nonfinal',
    });
    console.log("Recommendation Result:", recommendation);
  } catch (err) {
    console.error("readContract failed:", err);
  }

  try {
    const tx = await client.request({
      method: "eth_getTransactionByHash",
      params: ["0xf07ea803f6653aaeaa12bd440afa573c52c0596c6723c86d529f9402f5562169"],
    });
    console.log("Transaction Execution Details:", JSON.stringify(tx, null, 2));
  } catch (err) {
    console.error("eth_getTransactionByHash failed:", err);
  }
}

main().catch(console.error);
