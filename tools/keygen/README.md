# AccelX key generator (seller only)

Never ship this tool or its `private.key`.

1. Run `accelx-keygen.exe` and choose **1) First-time setup**. It creates `private.key` (secret, back it up)
   and prints your PUBLIC key. Paste that public key into `src-tauri/license_pub.hex` and rebuild AccelX.
2. For each sale: the customer sends the PC ID shown in AccelX. Choose **2) Make a license key**,
   paste the PC ID, a name for your log, and optionally a number of days (empty = lifetime).
3. Send the printed key to the customer. Each sale is appended to `sales-log.csv`.

Command line: `accelx-keygen sign A1B2-C3D4-E5F6 --days 30 --name "buyer"`
