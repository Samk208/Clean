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

test.describe('Brand/Supplier Onboarding - Document Uploads', () => {
  test('can sign up, reach Business Verification, and upload required documents', async ({ page }) => {
    const email = randomEmail('e2e.brand')
    await page.goto('/sign-up')

    // Wait for page to render
    await page.getByRole('heading', { name: 'Create your account' }).waitFor()
    // Choose role: Supplier
    await page.getByLabel('Supplier').click()

    // Fill form
    await page.getByLabel('First name').fill('E2E')
    await page.getByLabel('Last name').fill('Brand')
    await page.getByLabel('Email address').fill(email)
    await page.getByLabel('Password').fill('Passw0rd!')
    await page.getByLabel('Confirm password').fill('Passw0rd!')

    await page.getByRole('button', { name: 'Create account' }).click()

    // Expect onboarding
    await page.waitForURL(/\/auth\/onboarding\?role=brand/i, { timeout: 15000 })

    // Advance until Business Verification visible
    await page.waitForSelector('text=Business Verification', { timeout: 30000 })

    // Upload required documents
    await page.setInputFiles('#registration-upload', [file('registration.pdf', 'application/pdf')])
    await page.setInputFiles('#bank-upload', [file('bank.pdf', 'application/pdf')])
    await page.setInputFiles('#rep-upload', [file('rep.png', 'image/png')])

    // Optionally toggle retail permit and upload
    const permitToggle = page.getByText('I have a mail-order/online retail permit', { exact: false })
    if (await permitToggle.count()) {
      await permitToggle.first().click()
      await page.setInputFiles('#permit-upload', [file('permit.pdf', 'application/pdf')]).catch(() => {})
    }

    // Expect at least one success badge
    const uploadedCount = await page.locator('text=Uploaded').count()
    expect(uploadedCount).toBeGreaterThan(0)

    // Continue
    await page.getByRole('button', { name: /^Continue$/ }).click()
  })
})
