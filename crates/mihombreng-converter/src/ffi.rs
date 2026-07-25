use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::panic::catch_unwind;

use crate::parser::parse_payload;
use crate::types::{string_to_c_char, CProxy, CProxyArray};

#[no_mangle]
pub extern "C" fn parse_subscription_payload(input: *const c_char) -> CProxyArray {
    let result = catch_unwind(|| {
        if input.is_null() {
            return CProxyArray {
                proxies: std::ptr::null_mut(),
                count: 0,
                error: string_to_c_char("Input pointer is null"),
            };
        }

        let c_str = unsafe { CStr::from_ptr(input) };
        let input_str = match c_str.to_str() {
            Ok(s) => s,
            Err(_) => {
                return CProxyArray {
                    proxies: std::ptr::null_mut(),
                    count: 0,
                    error: string_to_c_char("Input string is invalid UTF-8"),
                };
            }
        };

        let proxies = parse_payload(input_str);
        let count = proxies.len();

        if count == 0 {
            return CProxyArray {
                proxies: std::ptr::null_mut(),
                count: 0,
                error: std::ptr::null(),
            };
        }

        let mut c_proxies: Vec<CProxy> = proxies.into_iter().map(|p| p.to_c_proxy()).collect();
        c_proxies.shrink_to_fit();

        let boxed_slice = c_proxies.into_boxed_slice();
        let ptr = Box::into_raw(boxed_slice) as *mut CProxy;

        CProxyArray {
            proxies: ptr,
            count,
            error: std::ptr::null(),
        }
    });

    match result {
        Ok(arr) => arr,
        Err(_) => CProxyArray {
            proxies: std::ptr::null_mut(),
            count: 0,
            error: string_to_c_char("Internal panic during payload parsing"),
        },
    }
}

#[no_mangle]
pub extern "C" fn free_proxy_array(arr: CProxyArray) {
    let _ = catch_unwind(|| unsafe {
        if !arr.error.is_null() {
            let _ = CString::from_raw(arr.error as *mut c_char);
        }

        if !arr.proxies.is_null() && arr.count > 0 {
            let slice = std::slice::from_raw_parts_mut(arr.proxies, arr.count);
            for c_proxy in slice.iter_mut() {
                c_proxy.free_strings();
            }
            let raw_slice = std::ptr::slice_from_raw_parts_mut(arr.proxies, arr.count);
            let _ = Box::from_raw(raw_slice);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ffi_parsing_and_freeing() {
        let input = CString::new("trojan://pass@1.2.3.4:443#TestTrojan\nvless://uuid@5.6.7.8:443#TestVless").unwrap();
        let arr = parse_subscription_payload(input.as_ptr());
        assert!(arr.error.is_null());
        assert_eq!(arr.count, 2);
        assert!(!arr.proxies.is_null());

        unsafe {
            let first = &*arr.proxies;
            let name_str = CStr::from_ptr(first.name).to_str().unwrap();
            assert_eq!(name_str, "TestTrojan");
        }

        free_proxy_array(arr);
    }
}
