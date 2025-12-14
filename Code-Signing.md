For Code Signing:

- `CSC_IDENTITY`: Your certificate name (e.g., "Developer ID Application: Your Name (TEAM_ID)")
- `CSC_LINK`: Base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD`: Password for the .p12 certificate

For Notarization (choose one method):

Method 1 - App Store Connect API Key (Recommended):

- `APPLE_API_KEY`: Your .p8 API key file content (or base64-encoded)
- `APPLE_API_KEY_ID`: Your API key ID (10 characters)
- `APPLE_API_ISSUER`: Your issuer ID (UUID)

Method 2 - App-specific Password:

- `APPLE_ID`: Your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Your team ID (10 characters)

How to Get These:

1. Developer ID Certificate: Create in Apple Developer Portal
2. App Store Connect API Key: Create in App Store Connect (Users and Access > Keys)
3. Export Certificate: Use Keychain Access to export as .p12, then base64 encode it

Once these secrets are added, the next build will be code signed and notarized, and users won't see the "damaged" error.
