import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { TransactionStatus } from 'genlayer-js/types';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Read and parse .env.build manually since 'private key' contains a space
const envPath = path.join(process.cwd(), '.env.build');
let privateKey: string | undefined;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/private\s+key\s*=\s*([^\r\n]+)/i);
  if (match && match[1]) {
    privateKey = match[1].trim();
  }
} catch (err) {
  console.error("Failed to read .env.build file:", err);
  process.exit(1);
}

if (!privateKey) {
  console.error("Error: 'private key' not found in .env.build");
  process.exit(1);
}

async function main() {
  const cleanKey = privateKey.trim();
  const account = createAccount(cleanKey as `0x${string}`);
  const client = createClient({
    chain: studionet,
    account: account,
  });

  const addressFilePath = path.join(process.cwd(), 'src/contract-address.json');
  if (!fs.existsSync(addressFilePath)) {
    console.error("Error: contract-address.json not found. Run deploy first.");
    process.exit(1);
  }
  const { address } = JSON.parse(fs.readFileSync(addressFilePath, 'utf8'));
  console.log("Testing contract at:", address);

  const requestId = "test_" + Math.random().toString(36).substring(7);
  const situation = "My birthday is next week. I finally bought a PS5. What game should I get?";
  console.log(`Sending request_recommendation with ID: ${requestId} and situation: "${situation}"`);

  const txHash = await client.writeContract({
    address: address,
    functionName: 'request_recommendation',
    args: [requestId, situation],
  });
  console.log("Transaction Hash:", txHash);

  console.log("Waiting for receipt (consensus evaluation)...");
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
    retries: 100,
    interval: 5000,
  });
  console.log("Transaction status:", receipt.status);

  console.log("Reading recommendation...");
  const recommendation = await client.readContract({
    address: address,
    functionName: 'get_recommendation',
    args: [requestId],
    transactionHashVariant: 'latest-nonfinal',
  });

  console.log("Recommendation received from on-chain state:");
  console.log(recommendation);

  console.log("Marking product as purchased...");
  const purchaseTx = await client.writeContract({
    address: address,
    functionName: 'purchase_product',
    args: [requestId],
  });
  console.log("Purchase transaction Hash:", purchaseTx);
  
  await client.waitForTransactionReceipt({ 
    hash: purchaseTx,
    status: TransactionStatus.ACCEPTED,
    retries: 100,
    interval: 5000,
  });
  
  const isPurchased = await client.readContract({
    address: address,
    functionName: 'is_purchased',
    args: [requestId],
    transactionHashVariant: 'latest-nonfinal',
  });
  console.log("Is purchased on-chain:", isPurchased);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
