# Siggy Shopper - Decentralized AI Consensus Shopping Assistant

Siggy Shopper is an intelligent, intent-based shopping assistant powered by **GenLayer**. It demonstrates how decentralized smart contracts can perform complex subjective reasoning, browse the live web, and achieve consensus on qualitative outcomes without traditional oracles.

---

## 🌟 Overview & Key Concepts

Traditional blockchain smart contracts are strictly deterministic and isolated from the real world. Siggy Shopper utilizes **GenLayer's Intelligent Contracts** to bridge this gap, enabling intent-based e-commerce helper scripts directly on-chain.

### 🧠 Intent-Based Shopping
Instead of searching for specific item SKUs, users describe their real-life situation, constraints, and budget in plain English (e.g., *"My birthday is next week. I finally bought a PS5. What game should I get?"* or *"Looking for a lightweight sunscreen for sensitive skin under $30"*).
1. **Intent Extraction:** The contract's leader validator uses a Large Language Model (LLM) to analyze the user's natural language situation and extract search queries and constraints.
2. **Autonomous Web Search:** The contract performs a real-time HTTP crawl across general search engines (Google, Bing, Yahoo, Ask) to locate active product listings.
3. **Decentralized Recommendation:** An AI shopping agent selects the absolute best match from the search results (or internal knowledge in fallback scenarios) and parses it into structured product data, including **real-time product images**, prices, merchants, and matching confidence scores.

### 🛡️ Powered by GenLayer (GenVM)
* **Intelligent Contracts (Python):** Written in Python and executed inside the **GenVM** (GenLayer Virtual Machine). The contract natively supports non-deterministic actions like web requests (`gl.nondet.web.get`) and LLM prompting (`gl.nondet.exec_prompt`).
* **Optimistic Democracy & AI Validators:** Non-deterministic outcomes (like product selection and web text scraping) are verified by a committee of AI-validator nodes. The contract enforces validator agreement on equivalence principles, ensuring the proposed recommendation is valid and qualitatively satisfies the user's requirements.
* **Consensus Resilience:** Built with robust fallbacks. If search providers are rate-limited or transient timeouts occur, the contract programmatically builds context-aware recommendations matching user intent so that transactions are guaranteed to reach consensus and finalize.

---

## 🛠️ Architecture

* **Intelligent Contract:** Located in [`contracts/siggy_shopper.py`](file:///c:/Users/Tech%20Shine/Documents/Siggy%20Shopper/contracts/siggy_shopper.py). Handles intent analysis, web page content cleaning (extracting image URLs and text), product recommendations, and purchase records.
* **Frontend Application:** A React + TypeScript + Vite app located in `src/`.
  * Secret Ephemeral Wallet: Automatically generates and saves a private key on load, connecting to Studionet invisibly.
  * Consensus Stepper: Displays the transaction lifecycle pipeline in real-time (mempool, intent analysis, web crawler, AI selection, validator consensus).
  * Direct Shopping Links: Links the user directly to buy matching products on Amazon, Google Shopping, or the target store.

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v18 or higher)
* Python 3.11+ (for local GenVM development/linting)

### Installation
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Build configuration setup:
   Ensure `.env.build` is present in the root directory. This holds the deployment private key:
   ```env
   private key = 0x...
   ```

### 🛰️ Deploy & Test Scripts

1. **Deploy the Smart Contract:**
   Deploy the Python contract to GenLayer Studionet. This writes the new contract address to `src/contract-address.json`.
   ```bash
   npx ts-node scripts/deploy.ts
   ```

2. **Run Consensus Tests:**
   Send a sample request transaction, wait for the AI committee consensus evaluation, and execute an on-chain purchase registry check:
   ```bash
   npx ts-node scripts/test_contract.ts
   ```

3. **Local Dev Server:**
   Start the local frontend development server:
   ```bash
   npm run dev
   ```

---

## 🌐 Production Deployment

The frontend application can be built for production using:
```bash
npm run build
```
It is configured for quick deployment on Vercel or similar static hosting providers.
