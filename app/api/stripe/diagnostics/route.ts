import { NextResponse } from "next/server"
import Stripe from "stripe"

export const runtime = "nodejs"

export async function GET() {
  const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""
  const secret = process.env.STRIPE_SECRET_KEY || ""
  const webhook = process.env.STRIPE_WEBHOOK_SECRET || ""

  const result: any = {
    ok: true,
    env: {
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: publishable ? `${publishable.slice(0, 7)}…` : null,
      STRIPE_SECRET_KEY: secret ? `${secret.slice(0, 7)}…` : null,
      STRIPE_WEBHOOK_SECRET: webhook ? `${webhook.slice(0, 7)}…` : null,
    },
    checks: {
      publishableLooksValid: /^pk_(test|live)_/.test(publishable),
      secretLooksValid: /^sk_(test|live)_/.test(secret),
      webhookLooksValid: /^whsec_/.test(webhook),
    },
  }

  if (!secret) {
    return NextResponse.json({ ok: false, message: "Missing STRIPE_SECRET_KEY", ...result }, { status: 500 })
  }

  try {
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" })
    // lightweight call to verify secret works
    const account = await stripe.accounts.retrieve()
    result.account = {
      id: account.id,
      email: (account as any).email ?? null,
      type: account.type,
      settings_payouts_schedule_interval: (account.settings as any)?.payouts?.schedule?.interval ?? null,
    }
  } catch (err) {
    return NextResponse.json({ ok: false, message: "Stripe secret key failed authentication", error: `${err}` , ...result }, { status: 500 })
  }

  return NextResponse.json(result)
}
