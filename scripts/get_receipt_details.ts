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
  const addressFilePath = path.join(process.cwd(), 'src/contract-address.json');
  if (fs.existsSync(addressFilePath)) {
    const { address } = JSON.parse(fs.readFileSync(addressFilePath, 'utf8'));
    console.log("Deployed address in JSON:", address);
  }

  const bigintReplacer = (key: any, value: any) => typeof value === 'bigint' ? value.toString() : value;

  // Let's query a transaction receipt we sent
  const testTxHash = "0xf07ea803f6653aaeaa12bd440afa573c52c0596c6723c86d529f9402f5562169";
  console.log("Querying test tx receipt for:", testTxHash);
  try {
    const receipt = await client.getTransactionReceipt({ hash: testTxHash });
    console.log("Test Tx Receipt:", JSON.stringify(receipt, bigintReplacer, 2));
  } catch (err) {
    console.error("Failed to get test receipt:", err);
  }
}

main().catch(console.error);
