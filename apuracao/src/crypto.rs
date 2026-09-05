//! Criptografia da carga da urna.
//!
//! Esquema simétrico (grau-demonstração, ver `docs/plan/ajuste-criptografia-front.md`):
//! a chave de 6 dígitos da urna é a chave compartilhada. Deriva-se uma chave AES-256
//! via `SHA-256(codigo)` e criptografa-se com AES-GCM. O envelope é
//! `base64( JSON {"iv","d"} )`, e o hash de integridade é `SHA-256` hex sobre a
//! serialização canônica (chaves ordenadas) — idêntico ao `stableStringify`/`hashJson`
//! do `frontend-logic.js` da urna.

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::Aes256Gcm;
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::Value;
use sha2::{Digest, Sha256};

/// `SHA-256` de `bytes` em hex minúsculo.
#[must_use]
pub fn sha256_hex(bytes: &[u8]) -> String {
    Sha256::digest(bytes)
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect()
}

/// Serialização canônica idêntica ao `stableStringify` da urna:
/// objetos com chaves ordenadas, arrays na ordem, primitivos via JSON.
#[must_use]
pub fn stable_stringify(v: &Value) -> String {
    match v {
        Value::Object(map) => {
            let mut keys: Vec<&String> = map.keys().collect();
            keys.sort();
            let parts: Vec<String> = keys
                .iter()
                .map(|k| {
                    format!(
                        "{}:{}",
                        serde_json::to_string(k).unwrap_or_default(),
                        stable_stringify(&map[*k])
                    )
                })
                .collect();
            format!("{{{}}}", parts.join(","))
        }
        Value::Array(arr) => {
            let parts: Vec<String> = arr.iter().map(stable_stringify).collect();
            format!("[{}]", parts.join(","))
        }
        other => serde_json::to_string(other).unwrap_or_default(),
    }
}

/// Criptografa `plaintext` com a chave derivada do `code` (6 dígitos).
/// Retorna o envelope `base64( JSON {"iv","d"} )` no formato que a urna importa.
pub fn encrypt_with_code(code: &str, plaintext: &str) -> Result<String, String> {
    let key_bytes = Sha256::digest(code.as_bytes());
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng); // 12 bytes
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| e.to_string())?;
    let inner = serde_json::json!({
        "iv": STANDARD.encode(nonce),
        "d": STANDARD.encode(ciphertext),
    });
    let inner_json = serde_json::to_string(&inner).map_err(|e| e.to_string())?;
    Ok(STANDARD.encode(inner_json.as_bytes()))
}

/// Descriptografa o envelope `base64( JSON {"iv","d"} )` com a chave derivada do
/// `code` (6 dígitos). Inverso de [`encrypt_with_code`] — usado ao receber o
/// `poll_report` da urna. Retorna o texto (JSON) em claro.
pub fn decrypt_with_code(code: &str, envelope_base64: &str) -> Result<String, String> {
    let key_bytes = Sha256::digest(code.as_bytes());
    let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;

    let inner_bytes = STANDARD
        .decode(envelope_base64.trim())
        .map_err(|_| "envelope não é base64 válido".to_string())?;
    let inner: Value = serde_json::from_slice(&inner_bytes)
        .map_err(|_| "envelope não é um JSON válido".to_string())?;
    let iv_b64 = inner
        .get("iv")
        .and_then(Value::as_str)
        .ok_or("envelope sem campo 'iv'")?;
    let d_b64 = inner
        .get("d")
        .and_then(Value::as_str)
        .ok_or("envelope sem campo 'd'")?;

    let iv = STANDARD
        .decode(iv_b64)
        .map_err(|_| "iv inválido".to_string())?;
    let data = STANDARD
        .decode(d_b64)
        .map_err(|_| "conteúdo inválido".to_string())?;
    if iv.len() != 12 {
        return Err("iv com tamanho inesperado".to_string());
    }
    #[allow(deprecated)]
    let nonce = aes_gcm::Nonce::from_slice(&iv);

    let plaintext = cipher.decrypt(nonce, data.as_ref()).map_err(|_| {
        "falha ao descriptografar (chave incorreta ou arquivo corrompido)".to_string()
    })?;
    String::from_utf8(plaintext).map_err(|_| "conteúdo decifrado não é texto válido".to_string())
}
