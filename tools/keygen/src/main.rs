//! AccelX key generator. SELLER ONLY: this tool owns the private key. Never ship it.
//!
//! Double-click for a menu, or use:
//!   accelx-keygen init
//!   accelx-keygen sign A1B2-C3D4-E5F6 [--days 30] [--name "discord name"]

use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use ed25519_dalek::{Signer, SigningKey};
use rand_core::OsRng;

#[path = "../../../src-tauri/src/licensefmt.rs"]
mod licensefmt;
use licensefmt::{build_payload, encode_key, hex_decode, hex_encode, message};

fn exe_dir() -> PathBuf {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn init() -> Result<(), String> {
    let dir = exe_dir();
    let priv_path = dir.join("private.key");
    if priv_path.exists() {
        return Err(
            "private.key already exists next to this program. Deleting it creates a NEW keypair \
             and every key you already sold stops working in new builds. Delete it only if you mean it."
                .into(),
        );
    }
    let sk = SigningKey::generate(&mut OsRng);
    fs::write(&priv_path, hex_encode(&sk.to_bytes())).map_err(|e| format!("Can't write private.key: {e}"))?;
    let pub_hex = hex_encode(sk.verifying_key().as_bytes());
    let _ = fs::write(dir.join("license_pub.hex"), &pub_hex);

    println!("\nKeypair created in: {}", dir.display());
    println!("\n  private.key     -> KEEP SECRET. Back it up. Never upload it anywhere.");
    println!("  license_pub.hex -> the public key (safe to share)\n");
    println!("Your PUBLIC key (paste this into src-tauri/license_pub.hex on GitHub, replacing the placeholder):\n");
    println!("{pub_hex}\n");
    println!("Then rebuild AccelX so the app contains this public key.");
    Ok(())
}

fn load_signing_key() -> Result<SigningKey, String> {
    let path = exe_dir().join("private.key");
    let text = fs::read_to_string(&path)
        .map_err(|_| format!("No private.key next to this program ({}). Run setup first.", path.display()))?;
    let bytes = hex_decode(&text).ok_or("private.key is damaged.")?;
    let arr: [u8; 32] = bytes.try_into().map_err(|_| "private.key has the wrong length.".to_string())?;
    Ok(SigningKey::from_bytes(&arr))
}

fn parse_pc(s: &str) -> Result<[u8; 6], String> {
    let hex: String = s.chars().filter(|c| c.is_ascii_hexdigit()).collect();
    if hex.len() != 12 {
        return Err("A PC ID looks like A1B2-C3D4-E5F6 (12 letters/numbers).".into());
    }
    let bytes = hex_decode(&hex).ok_or("PC ID isn't valid hex.")?;
    let mut out = [0u8; 6];
    out.copy_from_slice(&bytes);
    Ok(out)
}

fn sign(pc: &str, days: Option<u32>, name: &str) -> Result<String, String> {
    let sk = load_signing_key()?;
    let pc_bytes = parse_pc(pc)?;
    let expiry: u32 = match days {
        None => 0,
        Some(d) => {
            let t = now_secs() + d as u64 * 86_400;
            u32::try_from(t).map_err(|_| "Expiry date is too far away.".to_string())?
        }
    };
    let payload = build_payload(expiry, pc_bytes);
    let sig = sk.sign(&message(&payload));
    let key = encode_key(&payload, &sig.to_bytes());

    // sales log
    let log = exe_dir().join("sales-log.csv");
    let is_new = !log.exists();
    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&log) {
        if is_new {
            let _ = writeln!(f, "issued_unix,name,pc_id,expires_unix,key_start");
        }
        let pc_hex: String = pc_bytes.iter().map(|b| format!("{:02X}", b)).collect();
        let _ = writeln!(
            f,
            "{},{},{},{},{}",
            now_secs(),
            name.replace(',', " "),
            pc_hex,
            expiry,
            &key[..24.min(key.len())]
        );
    }
    Ok(key)
}

fn prompt(label: &str) -> String {
    print!("{label}");
    let _ = io::stdout().flush();
    let mut s = String::new();
    let _ = io::stdin().read_line(&mut s);
    s.trim().to_string()
}

fn pause() {
    let _ = prompt("\nPress Enter to close...");
}

fn make_key_interactive() {
    let pc = prompt("Customer's PC ID (e.g. A1B2-C3D4-E5F6): ");
    let name = prompt("Customer name / Discord (for your sales log): ");
    let days_in = prompt("Days until expiry (press Enter for lifetime): ");
    let days = if days_in.is_empty() { None } else { days_in.parse::<u32>().ok() };
    if !days_in.is_empty() && days.is_none() {
        println!("\nThat isn't a number of days.");
        return;
    }
    match sign(&pc, days, &name) {
        Ok(key) => {
            println!("\n=== LICENSE KEY (send this to the customer) ===\n");
            println!("{key}\n");
            println!("Logged to sales-log.csv");
        }
        Err(e) => println!("\nError: {e}"),
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match args.first().map(|s| s.as_str()) {
        Some("init") => {
            if let Err(e) = init() {
                eprintln!("Error: {e}");
                std::process::exit(1);
            }
        }
        Some("sign") => {
            let pc = args.get(1).cloned().unwrap_or_default();
            let mut days = None;
            let mut name = String::new();
            let mut i = 2;
            while i < args.len() {
                match args[i].as_str() {
                    "--days" => {
                        days = args.get(i + 1).and_then(|v| v.parse::<u32>().ok());
                        i += 1;
                    }
                    "--name" => {
                        name = args.get(i + 1).cloned().unwrap_or_default();
                        i += 1;
                    }
                    _ => {}
                }
                i += 1;
            }
            match sign(&pc, days, &name) {
                Ok(key) => println!("{key}"),
                Err(e) => {
                    eprintln!("Error: {e}");
                    std::process::exit(1);
                }
            }
        }
        _ => loop {
            println!("\n==== AccelX key generator (seller only) ====");
            println!("1) First-time setup (create your keypair)");
            println!("2) Make a license key");
            println!("3) Quit");
            match prompt("> ").as_str() {
                "1" => {
                    if let Err(e) = init() {
                        println!("\nError: {e}");
                    }
                }
                "2" => make_key_interactive(),
                "3" | "q" | "" => break,
                _ => println!("Pick 1, 2 or 3."),
            }
            pause();
        },
    }
}
