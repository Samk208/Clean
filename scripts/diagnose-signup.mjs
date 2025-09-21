#!/usr/bin/env node
/*
  Diagnose sign-up locally.
  - Checks env via /api/debug/env
  - Attempts a sign-up with a random email
  - Prints full JSON responses and any debug fields

  Usage:
    node scripts/diagnose-signup.mjs
*/

const BASE_URL = process.env.APP_URL || 'http://localhost:3000'

function logSection(title) {
  console.log(`\n=== ${title} ===`)
}

async function getJson(url, options = {}) {
  const res = await fetch(url, options)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: json }
}

async function main() {
  logSection('Environment check')
  try {
    const env = await getJson(`${BASE_URL}/api/debug/env`)
    console.log(JSON.stringify(env, null, 2))
  } catch (e) {
    console.error('Env check failed:', e)
  }

  logSection('Sign-up attempt')
  const rand = Math.floor(Math.random() * 1e6)
  const email = `diagnostic.user+${rand}@example.com`
  const payload = {
    firstName: 'Diag',
    lastName: 'User',
    email,
    password: 'Passw0rd!',
    confirmPassword: 'Passw0rd!',
    role: 'influencer'
  }
  try {
    const res = await getJson(`${BASE_URL}/api/auth/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    console.log('Request payload:', payload)
    console.log(JSON.stringify(res, null, 2))
    if (res.status >= 400) process.exitCode = 1
  } catch (e) {
    console.error('Sign-up request failed:', e)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error('Unexpected error:', e)
  process.exit(1)
})
