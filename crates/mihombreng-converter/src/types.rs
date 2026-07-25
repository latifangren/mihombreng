use std::ffi::CString;
use std::os::raw::c_char;

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Proxy {
    pub name: String,
    pub proxy_type: String,
    pub raw: String,
    pub server: String,
    pub port: u16,
    pub uuid: String,
    pub password: String,
    pub cipher: String,
    pub udp: bool,
    pub tls: bool,
    pub sni: String,
    pub network: String,
    pub ws_path: String,
    pub flow: String,
    pub skip_cert_verify: bool,
}

impl Default for Proxy {
    fn default() -> Self {
        Self {
            name: String::new(),
            proxy_type: String::new(),
            raw: String::new(),
            server: String::new(),
            port: 0,
            uuid: String::new(),
            password: String::new(),
            cipher: String::new(),
            udp: true,
            tls: false,
            sni: String::new(),
            network: "tcp".to_string(),
            ws_path: String::new(),
            flow: String::new(),
            skip_cert_verify: false,
        }
    }
}

#[repr(C)]
pub struct CProxy {
    pub name: *mut c_char,
    pub proxy_type: *mut c_char,
    pub raw: *mut c_char,
    pub server: *mut c_char,
    pub port: u16,
    pub uuid: *mut c_char,
    pub password: *mut c_char,
    pub cipher: *mut c_char,
    pub udp: bool,
    pub tls: bool,
    pub sni: *mut c_char,
    pub network: *mut c_char,
    pub ws_path: *mut c_char,
    pub flow: *mut c_char,
    pub skip_cert_verify: bool,
}

#[repr(C)]
pub struct CProxyArray {
    pub proxies: *mut CProxy,
    pub count: usize,
    pub error: *const c_char,
}

#[repr(C)]
pub struct CIpInterval {
    pub start: *mut u8,
    pub start_len: usize,
    pub end: *mut u8,
    pub end_len: usize,
}

#[repr(C)]
pub struct CIpIntervalArray {
    pub intervals: *mut CIpInterval,
    pub count: usize,
    pub error: *const c_char,
}

impl CIpInterval {
    pub unsafe fn free_bytes(&mut self) {
        if !self.start.is_null() && self.start_len > 0 {
            let slice = std::ptr::slice_from_raw_parts_mut(self.start, self.start_len);
            let _ = Box::from_raw(slice);
        }
        if !self.end.is_null() && self.end_len > 0 {
            let slice = std::ptr::slice_from_raw_parts_mut(self.end, self.end_len);
            let _ = Box::from_raw(slice);
        }
    }
}

pub fn string_to_c_char(s: &str) -> *mut c_char {
    let clean = s.replace('\0', "");
    CString::new(clean).unwrap_or_default().into_raw()
}

pub unsafe fn free_c_char(ptr: *mut c_char) {
    if !ptr.is_null() {
        let _ = CString::from_raw(ptr);
    }
}

impl CProxy {
    pub unsafe fn free_strings(&mut self) {
        free_c_char(self.name);
        free_c_char(self.proxy_type);
        free_c_char(self.raw);
        free_c_char(self.server);
        free_c_char(self.uuid);
        free_c_char(self.password);
        free_c_char(self.cipher);
        free_c_char(self.sni);
        free_c_char(self.network);
        free_c_char(self.ws_path);
        free_c_char(self.flow);
    }
}

impl Proxy {
    pub fn to_c_proxy(&self) -> CProxy {
        CProxy {
            name: string_to_c_char(&self.name),
            proxy_type: string_to_c_char(&self.proxy_type),
            raw: string_to_c_char(&self.raw),
            server: string_to_c_char(&self.server),
            port: self.port,
            uuid: string_to_c_char(&self.uuid),
            password: string_to_c_char(&self.password),
            cipher: string_to_c_char(&self.cipher),
            udp: self.udp,
            tls: self.tls,
            sni: string_to_c_char(&self.sni),
            network: string_to_c_char(&self.network),
            ws_path: string_to_c_char(&self.ws_path),
            flow: string_to_c_char(&self.flow),
            skip_cert_verify: self.skip_cert_verify,
        }
    }
}
