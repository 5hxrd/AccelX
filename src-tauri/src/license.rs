//! Offline, hardware-bound license check.
//!
//! The seller signs (PC id + expiry) with a private key that never ships. The app only holds
//! the PUBLIC key (src-tauri/license_pub.hex), so it can verify keys but never create them.
//! A key only validates on the PC whose id it was issued for.

use std::{
    fs,
    path::PathBuf,
    process::Command,
    time::{SystemTime, UNIX_EPOCH},
};

use ed25519_dalek::{Signature, VerifyingKey};
use serde::Serialize;
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Manager};

use crate::licensefmt::{decode_key, hex_decode, message, parse_payload};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

const PUBLIC_KEY_HEX: &str = include_str!("../license_pub.hex");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LicenseStatus {
    pub state: &'static str,
    pub expires_at: Option<u64>, // milliseconds since epoch, like JS Date.now()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivateResult {
    pub ok: bool,
    pub error: Option<String>,
    pub expires_at: Option<u64>,
}

enum Reason {
    NotConfigured,
    Invalid,
    Expired,
}

fn machine_guid() -> Option<String> {
    let mut cmd = Command::new("reg");
    cmd.args(["query", r"HKLM\SOFTWARE\Microsoft\Cryptography", "/v", "MachineGuid"]);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output().ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    text.lines()
        .find(|l| l.contains("MachineGuid"))
        .and_then(|l| l.split_whitespace().last())
        .map(|g| g.trim().to_lowercase())
        .filter(|g| g.len() >= 8)
}

/// 6 bytes derived from this PC's Windows MachineGuid.
pub fn pc_id_bytes() -> Option<[u8; 6]> {
    let guid = machine_guid()?;
    let digest = Sha256::digest(format!("accelx-pcid-v1:{guid}").as_bytes());
    let mut out = [0u8; 6];
    out.copy_from_slice(&digest[..6]);
    Some(out)
}

/// Shown to the user as XXXX-XXXX-XXXX.
pub fn pc_id_string() -> Option<String> {
    let b = pc_id_bytes()?;
    let hex: String = b.iter().map(|x| format!("{:02X}", x)).collect();
    Some(format!("{}-{}-{}", &hex[0..4], &hex[4..8], &hex[8..12]))
}

fn public_key() -> Option<VerifyingKey> {
    let bytes = hex_decode(PUBLIC_KEY_HEX)?;
    let arr: [u8; 32] = bytes.try_into().ok()?;
    VerifyingKey::from_bytes(&arr).ok()
}

/// Ok(None) = lifetime, Ok(Some(ms)) = expires at that time.
fn check_key(key: &str) -> Result<Option<u64>, Reason> {
    let vk = public_key().ok_or(Reason::NotConfigured)?;
    let (payload, sig_bytes) = decode_key(key).ok_or(Reason::Invalid)?;
    let signature = Signature::from_bytes(&sig_bytes);
    vk.verify_strict(&message(&payload), &signature)
        .map_err(|_| Reason::Invalid)?;
    let (expiry, pc) = parse_payload(&payload).ok_or(Reason::Invalid)?;
    let mine = pc_id_bytes().ok_or(Reason::Invalid)?;
    if pc != mine {
        return Err(Reason::Invalid);
    }
    if expiry != 0 {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if now >= expiry as u64 {
            return Err(Reason::Expired);
        }
        return Ok(Some(expiry as u64 * 1000));
    }
    Ok(None)
}

fn key_file(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("license.key"))
}

pub fn status(app: &AppHandle) -> LicenseStatus {
    let key = key_file(app).and_then(|p| fs::read_to_string(p).ok());
    match key.as_deref().map(check_key) {
        Some(Ok(expires_at)) => LicenseStatus { state: "active", expires_at },
        Some(Err(Reason::Expired)) => LicenseStatus { state: "expired", expires_at: None },
        _ => LicenseStatus { state: "unlicensed", expires_at: None },
    }
}

pub fn is_valid(app: &AppHandle) -> bool {
    status(app).state == "active"
}

pub fn activate(app: &AppHandle, key: &str) -> ActivateResult {
    match check_key(key) {
        Ok(expires_at) => {
            let saved = key_file(app).and_then(|p| {
                if let Some(dir) = p.parent() {
                    let _ = fs::create_dir_all(dir);
                }
                fs::write(p, key.trim()).ok()
            });
            if saved.is_none() {
                return ActivateResult {
                    ok: false,
                    error: Some("Couldn't save the license on this PC.".into()),
                    expires_at: None,
                };
            }
            ActivateResult { ok: true, error: None, expires_at }
        }
        Err(reason) => ActivateResult {
            ok: false,
            error: Some(
                match reason {
                    Reason::Expired => "This key has expired.",
                    Reason::NotConfigured => "Licensing isn't set up in this build.",
                    Reason::Invalid => "That key isn't valid for this PC.",
                }
                .into(),
            ),
            expires_at: None,
        },
    }
}

pub fn remove(app: &AppHandle) {
    if let Some(p) = key_file(app) {
        let _ = fs::remove_file(p);
    }
}
