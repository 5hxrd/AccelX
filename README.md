# AccelX

Modern mouse acceleration curve editor for Windows.

The acceleration engine is the official, signed [Raw Accel](https://github.com/RawAccelOfficial/rawaccel)
1.7.1 driver (MIT license, © a1xd), bundled inside `AccelX.exe`.
See `src-tauri/engine/LICENSE-RawAccel.txt`.

## Using AccelX.exe
1. Run `AccelX.exe` → Settings → Engine → **Install driver** (accept the Windows prompt).
2. Restart Windows once.
3. Shape your curve on the Curve tab and press **Apply**.
4. Turn on "Start with Windows" so the curve is restored after every boot
   (the driver forgets settings at shutdown).

## Build the exe on GitHub
Push this repo to GitHub → Actions → "Build AccelX" → download the `AccelX-windows` artifact.

## Dev
- Web preview (Lovable): `bun run dev`
- Desktop build: `bun run tauri build` (needs Rust)
