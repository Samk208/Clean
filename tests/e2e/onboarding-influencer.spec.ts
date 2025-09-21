import { test, expect } from '@playwright/test'

function randomEmail(prefix: string) {
  const n = Math.floor(Math.random() * 1e6)
  return `${prefix}+${n}@example.com`
}

function file(name: string, mimeType: string, content = 'dummy') {
  return {
    name,
    mimeType,
    buffer: Buffer.from(content),
  }
}

test.describe('Influencer Onboarding - Document Uploads', () => {
  test('can sign up, reach Identity Verification, and upload required documents', async ({ page }) => {
    const email = randomEmail('e2e.influencer')
    await page.goto('/sign-up')

    // Wait for page to render
    await page.getByRole('heading', { name: 'Create your account' }).waitFor()
    // Choose role: Influencer — target the radio directly to avoid strict-mode ambiguity
    await page.getByRole('radio', { name: 'Influencer' }).click()

    // Fill form
    await page.getByLabel('First name').fill('E2E')
    await page.getByLabel('Last name').fill('Influencer')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('Passw0rd!')
    await page.getByLabel('Confirm password').fill('Passw0rd!')

    await page.getByRole('button', { name: 'Create account' }).click()

    // Expect onboarding
    await page.waitForURL(/\/auth\/onboarding\?role=influencer/i, { timeout: 15000 })

    // Advance through steps until Identity Verification is visible
    await page.waitForSelector('text=Identity Verification', { timeout: 30000 })

    // Set document type (optional UI selection present)
    const docTypeDropdown = page.getByText('Select ID Document Type', { exact: false })
    if (await docTypeDropdown.count()) {
      await docTypeDropdown.first().click()
      await page.getByRole('option').first().click().catch(() => {})
    }

    // Upload files by targeting hidden inputs by id
    // ID Document
    await page.setInputFiles('#id-upload', [file('id.png', 'image/png')])
    // Selfie (prompt opens camera modal, but file input exists as #selfie-upload)
    await page.setInputFiles('#selfie-upload', [file('selfie.png', 'image/png')])
    // Proof of Address
    await page.setInputFiles('#address-upload', [file('address.pdf', 'application/pdf')])
    // Bank Statement
    await page.setInputFiles('#bank-upload', [file('bank.pdf', 'application/pdf')])

    // Expect at least one success badge to appear
    const uploadedCount = await page.locator('text=Uploaded').count()
    expect(uploadedCount).toBeGreaterThan(0)

    // Continue to next step
    await page.getByRole('button', { name: /^Continue$/ }).click()
  })
})
