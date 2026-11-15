# M-Pesa sandbox setup

Add these secrets in Lovable's secure secret form before testing the prompt:

- `DARAJA_CONSUMER_KEY` — the Consumer Key from a Daraja sandbox app with M-PESA Express enabled.
- `DARAJA_CONSUMER_SECRET` — the matching sandbox Consumer Secret.
- `DARAJA_PASSKEY` — the sandbox M-PESA Express passkey.

The app sends sandbox requests only and uses the test shortcode `174379`. It does not collect real money. The callback URL is `/api/public/fines/callback` on the deployed app's stable development URL during preview, and on the current origin after publish.
