#!/usr/bin/env node

/**
 * Cache Clearing Script for National Mini Mart POS
 * Run this script to clear build cache and force browser refresh
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Clearing Next.js cache...');

// Clear Next.js cache directories
const cacheDirs = [
  '.next',
  'node_modules/.cache',
  '.turbo'
];

cacheDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`Removing ${dir}...`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log('✅ Cache cleared successfully!');
console.log('💡 Tip: If you still experience slow loading, try:');
console.log('   1. Hard refresh (Ctrl+F5 or Cmd+Shift+R)');
console.log('   2. Clear browser cache in browser settings');
console.log('   3. Try incognito mode to test'); 