# Deploy webapp to Netlify.
# Requires env: NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID (from Netlify Site settings -> API).
# Or run `npx netlify login` once, then `npx netlify deploy --prod --dir=dist`.
Set-Location $PSScriptRoot\..\webapp
npm install
npm run build
if ($env:NETLIFY_AUTH_TOKEN -and $env:NETLIFY_SITE_ID) {
  npx netlify deploy --prod --dir=dist
} else {
  Write-Warning "Set NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID, or run: npx netlify login; npx netlify deploy --prod --dir=dist"
}
