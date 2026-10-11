#![allow(dead_code)]
//! License key format, shared by the app (which verifies) and the seller's key generator
//! (which signs). Std-only on purpose.
//!
//! Key = base32( payload(11 bytes) + Ed25519 signature(64 bytes) ), shown as ACCELX-XXXXXX-...
//! payload = version(1) + expiry unix seconds, big-endian (4, 0 = lifetime) + PC id (6)
//! The signature covers DOMAIN + payload.

pub const DOMAIN: &[u8] = b"ACCELX-LICENSE-v1";
pub const VERSION: u8 = 1;
pub const PAYLOAD_LEN: usize = 11;
pub const SIG_LEN: usize = 64;
const PREFIX: &str = "ACCELX";
const ALPHABET: &[u8; 32] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/// Number of base32 characters for payload + signature (75 bytes = 600 bits).
const KEY_CHARS: usize = 120;

pub fn message(payload: &[u8; PAYLOAD_LEN]) -> Vec<u8> {
    let mut m = DOMAIN.to_vec();
    m.extend_from_slice(payload);
    m
}

pub fn build_payload(expiry_unix: u32, pc: [u8; 6]) -> [u8; PAYLOAD_LEN] {
    let mut p = [0u8; PAYLOAD_LEN];
    p[0] = VERSION;
    p[1..5].copy_from_slice(&expiry_unix.to_be_bytes());
    p[5..11].copy_from_slice(&pc);
    p
}

/// Returns (expiry unix seconds, pc id).
pub fn parse_payload(p: &[u8]) -> Option<(u32, [u8; 6])> {
    if p.len() != PAYLOAD_LEN || p[0] != VERSION {
        return None;
    }
    let exp = u32::from_be_bytes([p[1], p[2], p[3], p[4]]);
    let mut pc = [0u8; 6];
    pc.copy_from_slice(&p[5..11]);
    Some((exp, pc))
}

pub fn base32_encode(data: &[u8]) -> String {
    let mut out = String::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &b in data {
        buf = (buf << 8) | b as u32;
        bits += 8;
        while bits >= 5 {
            out.push(ALPHABET[((buf >> (bits - 5)) & 31) as usize] as char);
            bits -= 5;
        }
        buf &= (1u32 << bits) - 1;
    }
    if bits > 0 {
        out.push(ALPHABET[((buf << (5 - bits)) & 31) as usize] as char);
    }
    out
}

pub fn base32_decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for c in s.chars() {
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            '2'..='7' => c as u32 - '2' as u32 + 26,
            _ => return None,
        };
        buf = (buf << 5) | v;
        bits += 5;
        if bits >= 8 {
            out.push(((buf >> (bits - 8)) & 0xff) as u8);
            bits -= 8;
            buf &= (1u32 << bits) - 1;
        }
    }
    Some(out)
}

/// Builds the human-readable key: ACCELX-XXXXXX-XXXXXX-...
pub fn encode_key(payload: &[u8; PAYLOAD_LEN], sig: &[u8; SIG_LEN]) -> String {
    let mut bytes = payload.to_vec();
    bytes.extend_from_slice(sig);
    let raw = base32_encode(&bytes);
    let mut out = String::from(PREFIX);
    for chunk in raw.as_bytes().chunks(6) {
        out.push('-');
        out.push_str(std::str::from_utf8(chunk).unwrap_or(""));
    }
    out
}

/// Accepts any spacing / hyphens / lowercase. Returns (payload, signature).
pub fn decode_key(input: &str) -> Option<([u8; PAYLOAD_LEN], [u8; SIG_LEN])> {
    let mut s: String = input
        .chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect();
    if s.len() == KEY_CHARS + PREFIX.len() && s.starts_with(PREFIX) {
        s = s[PREFIX.len()..].to_string();
    }
    if s.len() != KEY_CHARS {
        return None;
    }
    let bytes = base32_decode(&s)?;
    if bytes.len() != PAYLOAD_LEN + SIG_LEN {
        return None;
    }
    let mut payload = [0u8; PAYLOAD_LEN];
    let mut sig = [0u8; SIG_LEN];
    payload.copy_from_slice(&bytes[..PAYLOAD_LEN]);
    sig.copy_from_slice(&bytes[PAYLOAD_LEN..]);
    Some((payload, sig))
}

pub fn hex_encode(b: &[u8]) -> String {
    b.iter().map(|x| format!("{:02x}", x)).collect()
}

pub fn hex_decode(s: &str) -> Option<Vec<u8>> {
    let s = s.trim();
    if s.len() % 2 != 0 {
        return None;
    }
    (0..s.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&s[i..i + 2], 16).ok())
        .collect()
}
