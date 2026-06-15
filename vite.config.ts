import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as fs from 'fs'
import * as path from 'path'

// Load private key from .env.build manually
let privateKey = '';
try {
  const envPath = path.join(process.cwd(), '.env.build');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/private\s+key\s*=\s*([^\r\n]+)/i);
    if (match && match[1]) {
      privateKey = match[1].trim();
    }
  }
} catch (e) {
  console.warn("Could not read .env.build for vite config:", e);
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__VITE_PRIVATE_KEY__': JSON.stringify(privateKey)
  }
})
