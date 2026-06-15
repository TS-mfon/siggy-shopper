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
  console.log("Initializing account...");
  // Clear any potential whitespace or trailing newlines
  const cleanKey = privateKey.trim();
  const account = createAccount(cleanKey as `0x${string}`);
  console.log("Account address:", account.address);

  console.log("Initializing GenLayer client on studionet...");
  const client = createClient({
    chain: studionet,
    account: account,
  });

  const contractPath = path.join(process.cwd(), 'contracts/siggy_shopper.py');
  console.log("Reading contract code from:", contractPath);
  const code = fs.readFileSync(contractPath, 'utf8');

  console.log("Deploying contract...");
  const txHash = await client.deployContract({
    code: code,
    args: [],
  });
  console.log("Transaction sent. Hash:", txHash);

  console.log("Waiting for transaction receipt (ACCEPTED)...");
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
  });

  const bigintReplacer = (key: any, value: any) => typeof value === 'bigint' ? value.toString() : value;
  console.log("Full Deploy Receipt:", JSON.stringify(receipt, bigintReplacer, 2));

  const contractAddress = receipt.data?.contract_address;
  if (!contractAddress) {
    throw new Error("Contract address is missing from transaction receipt data");
  }

  console.log("Contract deployed successfully!");
  console.log("Contract Address:", contractAddress);

  // Ensure src directory exists
  const configDir = path.join(process.cwd(), 'src');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir);
  }
  
  const addressFilePath = path.join(configDir, 'contract-address.json');
  fs.writeFileSync(addressFilePath, JSON.stringify({ address: contractAddress }, null, 2));
  console.log("Contract address saved to:", addressFilePath);
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
