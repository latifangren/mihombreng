use base64::engine::general_purpose::{STANDARD, STANDARD_NO_PAD, URL_SAFE, URL_SAFE_NO_PAD};
use base64::Engine;
use percent_encoding::percent_decode_str;
use serde_json::Value;
use url::Url;

use crate::types::Proxy;

pub fn decode_base64(input: &str) -> Option<Vec<u8>> {
    let mut clean = input.trim().replace(['\n', '\r', ' '], "");
    if clean.is_empty() {
        return None;
    }
    // Pad if necessary
    while clean.len() % 4 != 0 {
        clean.push('=');
    }
    STANDARD
        .decode(&clean)
        .or_else(|_| STANDARD_NO_PAD.decode(&clean))
        .or_else(|_| URL_SAFE.decode(&clean))
        .or_else(|_| URL_SAFE_NO_PAD.decode(&clean))
        .ok()
}

pub fn decode_base64_to_string(input: &str) -> Option<String> {
    let bytes = decode_base64(input)?;
    String::from_utf8(bytes).ok()
}

pub fn parse_vmess(link: &str) -> Option<Proxy> {
    let payload = link.strip_prefix("vmess://")
        .or_else(|| link.strip_prefix("VMESS://"))?;
    let json_str = decode_base64_to_string(payload)?;
    let val: Value = serde_json::from_str(&json_str).ok()?;

    let mut proxy = Proxy::default();
    proxy.proxy_type = "vmess".to_string();
    proxy.raw = link.to_string();

    if let Some(ps) = val.get("ps").and_then(|v| v.as_str()) {
        proxy.name = ps.to_string();
    } else if let Some(remark) = val.get("remark").and_then(|v| v.as_str()) {
        proxy.name = remark.to_string();
    } else {
        proxy.name = "VMess".to_string();
    }

    if let Some(add) = val.get("add").and_then(|v| v.as_str()) {
        proxy.server = add.to_string();
    }

    if let Some(port_val) = val.get("port") {
        if let Some(p) = port_val.as_u64() {
            proxy.port = p as u16;
        } else if let Some(p_str) = port_val.as_str() {
            proxy.port = p_str.parse::<u16>().unwrap_or(0);
        }
    }

    if let Some(id) = val.get("id").and_then(|v| v.as_str()) {
        proxy.uuid = id.to_string();
    }

    if let Some(scy) = val.get("scy").and_then(|v| v.as_str()) {
        proxy.cipher = scy.to_string();
    } else if let Some(cipher) = val.get("cipher").and_then(|v| v.as_str()) {
        proxy.cipher = cipher.to_string();
    } else {
        proxy.cipher = "auto".to_string();
    }

    if let Some(net) = val.get("net").and_then(|v| v.as_str()) {
        proxy.network = net.to_string();
    }

    if let Some(path) = val.get("path").and_then(|v| v.as_str()) {
        proxy.ws_path = path.to_string();
    }

    if let Some(sni) = val.get("sni").and_then(|v| v.as_str()) {
        proxy.sni = sni.to_string();
    } else if let Some(host) = val.get("host").and_then(|v| v.as_str()) {
        proxy.sni = host.to_string();
    }

    if let Some(tls_val) = val.get("tls") {
        if let Some(s) = tls_val.as_str() {
            proxy.tls = s == "tls" || s == "true" || s == "1";
        } else if let Some(b) = tls_val.as_bool() {
            proxy.tls = b;
        }
    }

    if let Some(skip) = val.get("skip-cert-verify")
        .or_else(|| val.get("allowInsecure"))
    {
        if let Some(b) = skip.as_bool() {
            proxy.skip_cert_verify = b;
        } else if let Some(s) = skip.as_str() {
            proxy.skip_cert_verify = s == "true" || s == "1";
        }
    }

    Some(proxy)
}

pub fn parse_vless(link: &str) -> Option<Proxy> {
    let url = Url::parse(link).ok()?;
    if url.scheme() != "vless" {
        return None;
    }

    let mut proxy = Proxy::default();
    proxy.proxy_type = "vless".to_string();
    proxy.raw = link.to_string();
    proxy.uuid = percent_decode_str(url.username()).decode_utf8_lossy().to_string();
    proxy.server = url.host_str()?.to_string();
    proxy.port = url.port().unwrap_or(443);

    if let Some(frag) = url.fragment() {
        proxy.name = percent_decode_str(frag).decode_utf8_lossy().to_string();
    } else {
        proxy.name = "VLess".to_string();
    }

    proxy.cipher = "none".to_string();

    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "type" | "net" => proxy.network = v.to_string(),
            "security" => {
                let v_lower = v.to_lowercase();
                proxy.tls = v_lower == "tls" || v_lower == "reality";
            }
            "path" => proxy.ws_path = percent_decode_str(&v).decode_utf8_lossy().to_string(),
            "sni" | "host" => proxy.sni = v.to_string(),
            "flow" => proxy.flow = v.to_string(),
            "encryption" => proxy.cipher = v.to_string(),
            "allowInsecure" | "insecure" | "skip-cert-verify" => {
                proxy.skip_cert_verify = v == "1" || v.eq_ignore_ascii_case("true");
            }
            _ => {}
        }
    }

    if proxy.sni.is_empty() && proxy.tls {
        proxy.sni = proxy.server.clone();
    }

    Some(proxy)
}

pub fn parse_trojan(link: &str) -> Option<Proxy> {
    let url = Url::parse(link).ok()?;
    if url.scheme() != "trojan" {
        return None;
    }

    let mut proxy = Proxy::default();
    proxy.proxy_type = "trojan".to_string();
    proxy.raw = link.to_string();
    proxy.password = percent_decode_str(url.username()).decode_utf8_lossy().to_string();
    proxy.server = url.host_str()?.to_string();
    proxy.port = url.port().unwrap_or(443);

    if let Some(frag) = url.fragment() {
        proxy.name = percent_decode_str(frag).decode_utf8_lossy().to_string();
    } else {
        proxy.name = "Trojan".to_string();
    }

    proxy.tls = true;

    for (k, v) in url.query_pairs() {
        match k.as_ref() {
            "type" | "net" => proxy.network = v.to_string(),
            "security" => {
                if v == "none" {
                    proxy.tls = false;
                }
            }
            "sni" | "host" => proxy.sni = v.to_string(),
            "path" => proxy.ws_path = percent_decode_str(&v).decode_utf8_lossy().to_string(),
            "allowInsecure" | "insecure" | "skip-cert-verify" => {
                proxy.skip_cert_verify = v == "1" || v.eq_ignore_ascii_case("true");
            }
            _ => {}
        }
    }

    if proxy.sni.is_empty() && proxy.tls {
        proxy.sni = proxy.server.clone();
    }

    Some(proxy)
}

pub fn parse_shadowsocks(link: &str) -> Option<Proxy> {
    let body = link.strip_prefix("ss://")
        .or_else(|| link.strip_prefix("SS://"))?;

    let mut proxy = Proxy::default();
    proxy.proxy_type = "shadowsocks".to_string();
    proxy.raw = link.to_string();

    let (main_part, name) = if let Some((m, f)) = body.split_once('#') {
        (m, percent_decode_str(f).decode_utf8_lossy().to_string())
    } else {
        (body, "Shadowsocks".to_string())
    };

    proxy.name = name;

    let main_no_query = main_part.split('?').next().unwrap_or(main_part);

    if main_no_query.contains('@') {
        let (userinfo, hostport) = main_no_query.split_once('@')?;
        let decoded_userinfo = decode_base64_to_string(userinfo)
            .filter(|s| s.contains(':'))
            .unwrap_or_else(|| userinfo.to_string());

        if let Some((cipher, password)) = decoded_userinfo.split_once(':') {
            proxy.cipher = cipher.to_string();
            proxy.password = password.to_string();
        }

        let (server, port_str) = hostport.rsplit_once(':')?;
        proxy.server = server.trim_start_matches('[').trim_end_matches(']').to_string();
        proxy.port = port_str.parse::<u16>().ok()?;
    } else {
        let decoded = decode_base64_to_string(main_no_query)?;
        let (userinfo, hostport) = decoded.split_once('@')?;
        if let Some((cipher, password)) = userinfo.split_once(':') {
            proxy.cipher = cipher.to_string();
            proxy.password = password.to_string();
        }
        let (server, port_str) = hostport.rsplit_once(':')?;
        proxy.server = server.trim_start_matches('[').trim_end_matches(']').to_string();
        proxy.port = port_str.parse::<u16>().ok()?;
    }

    Some(proxy)
}

pub fn parse_single_line(line: &str) -> Option<Proxy> {
    let trimmed = line.trim();
    if trimmed.starts_with("vmess://") || trimmed.starts_with("VMESS://") {
        parse_vmess(trimmed)
    } else if trimmed.starts_with("vless://") || trimmed.starts_with("VLESS://") {
        parse_vless(trimmed)
    } else if trimmed.starts_with("trojan://") || trimmed.starts_with("TROJAN://") {
        parse_trojan(trimmed)
    } else if trimmed.starts_with("ss://") || trimmed.starts_with("SS://") {
        parse_shadowsocks(trimmed)
    } else {
        None
    }
}

pub fn parse_payload(input: &str) -> Vec<Proxy> {
    let mut results = Vec::new();
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return results;
    }

    let content = if !trimmed.contains("://") {
        decode_base64_to_string(trimmed).unwrap_or_else(|| trimmed.to_string())
    } else {
        trimmed.to_string()
    };

    for line in content.lines() {
        let line_trimmed = line.trim();
        if line_trimmed.is_empty() {
            continue;
        }

        if let Some(proxy) = parse_single_line(line_trimmed) {
            results.push(proxy);
        } else if let Some(decoded_line) = decode_base64_to_string(line_trimmed) {
            for sub_line in decoded_line.lines() {
                if let Some(proxy) = parse_single_line(sub_line.trim()) {
                    results.push(proxy);
                }
            }
        }
    }

    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_vless() {
        let link = "vless://12345678-1234-1234-1234-1234567890ab@example.com:443?type=ws&security=tls&path=%2Fws&sni=example.com#MyVless";
        let proxy = parse_vless(link).unwrap();
        assert_eq!(proxy.proxy_type, "vless");
        assert_eq!(proxy.name, "MyVless");
        assert_eq!(proxy.server, "example.com");
        assert_eq!(proxy.port, 443);
        assert_eq!(proxy.uuid, "12345678-1234-1234-1234-1234567890ab");
        assert_eq!(proxy.network, "ws");
        assert_eq!(proxy.ws_path, "/ws");
        assert!(proxy.tls);
    }

    #[test]
    fn test_parse_trojan() {
        let link = "trojan://mypass@example.com:443?type=grpc&sni=example.com#MyTrojan";
        let proxy = parse_trojan(link).unwrap();
        assert_eq!(proxy.proxy_type, "trojan");
        assert_eq!(proxy.name, "MyTrojan");
        assert_eq!(proxy.server, "example.com");
        assert_eq!(proxy.port, 443);
        assert_eq!(proxy.password, "mypass");
        assert_eq!(proxy.network, "grpc");
        assert!(proxy.tls);
    }

    #[test]
    fn test_parse_ss() {
        let link = "ss://YWVzLTEyOC1nY206cGFzc3dvcmQ=@127.0.0.1:8388#MySS";
        let proxy = parse_shadowsocks(link).unwrap();
        assert_eq!(proxy.proxy_type, "shadowsocks");
        assert_eq!(proxy.name, "MySS");
        assert_eq!(proxy.server, "127.0.0.1");
        assert_eq!(proxy.port, 8388);
        assert_eq!(proxy.cipher, "aes-128-gcm");
        assert_eq!(proxy.password, "password");
    }
}
