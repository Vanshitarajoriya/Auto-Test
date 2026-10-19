Hi team, I'm setting up automated QA: Playwright will run the tests for ClickUp cards on dev and post the result back on the card. I need a few answers before I can write real tests:

1. What is the dev base URL for the MSG91 APIs and the dashboard (instead of control.msg91.com)? Can it be reached from outside the office network, or is it behind a VPN / IP allowlist? If it is private I'll use a self-hosted runner.
2. Does dev send real SMS / WhatsApp / email / voice, or are messages simulated?
3. How can I add wallet credit on dev for a dedicated automation account?
4. How can a test read the OTP or email it just triggered (test inbox, test number, log API, or webhook)?

Also useful: can I create a dedicated automation account on dev (does the Add Client / Subaccount API work there), and which sender ID, DLT template and WhatsApp template are already set up on dev for testing?

Everything will run only on dev, from that one tagged test account (AUTO_TEST_ prefix), and will clean up after itself. Thanks!
