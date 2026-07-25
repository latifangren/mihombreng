use std::ffi::{CStr, CString};
use std::net::IpAddr;
use std::os::raw::c_char;
use std::panic::catch_unwind;
use ipnet::{IpNet, Ipv4Net, Ipv6Net};

use crate::parser::parse_payload;
use crate::types::{string_to_c_char, CIpInterval, CIpIntervalArray, CProxy, CProxyArray};

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

fn parse_cidr_or_ip(s: &str) -> Option<IpNet> {
    if let Ok(net) = s.parse::<IpNet>() {
        Some(net)
    } else if let Ok(ip) = s.parse::<IpAddr>() {
        match ip {
            IpAddr::V4(v4) => Ipv4Net::new(v4, 32).ok().map(IpNet::V4),
            IpAddr::V6(v6) => Ipv6Net::new(v6, 128).ok().map(IpNet::V6),
        }
    } else {
        None
    }
}

#[no_mangle]
pub extern "C" fn parse_and_merge_cidrs(
    input_cidrs: *const *const c_char,
    count: usize,
    ipv6: bool,
) -> CIpIntervalArray {
    let result = catch_unwind(|| {
        if input_cidrs.is_null() || count == 0 {
            return CIpIntervalArray {
                intervals: std::ptr::null_mut(),
                count: 0,
                error: std::ptr::null(),
            };
        }

        let slice = unsafe { std::slice::from_raw_parts(input_cidrs, count) };
        let mut raw_ranges: Vec<(u128, u128)> = Vec::new();

        for &ptr in slice {
            if ptr.is_null() {
                continue;
            }
            let c_str = unsafe { CStr::from_ptr(ptr) };
            let s = match c_str.to_str() {
                Ok(s) => s.trim(),
                Err(_) => continue,
            };
            if s.is_empty() {
                continue;
            }

            if let Some(net) = parse_cidr_or_ip(s) {
                match (net, ipv6) {
                    (IpNet::V4(v4), false) => {
                        let start = u32::from(v4.network()) as u128;
                        let end = u32::from(v4.broadcast()) as u128;
                        raw_ranges.push((start, end));
                    }
                    (IpNet::V6(v6), true) => {
                        let start = u128::from(v6.network());
                        let end = u128::from(v6.broadcast());
                        raw_ranges.push((start, end));
                    }
                    _ => {}
                }
            }
        }

        if raw_ranges.is_empty() {
            return CIpIntervalArray {
                intervals: std::ptr::null_mut(),
                count: 0,
                error: std::ptr::null(),
            };
        }

        raw_ranges.sort_by_key(|r| r.0);

        let mut merged: Vec<(u128, u128)> = Vec::new();
        for (start, end) in raw_ranges {
            if let Some(last) = merged.last_mut() {
                if start <= last.1.saturating_add(1) {
                    if end > last.1 {
                        last.1 = end;
                    }
                    continue;
                }
            }
            merged.push((start, end));
        }

        let mut c_intervals: Vec<CIpInterval> = Vec::with_capacity(merged.len());

        for (start, end) in merged {
            let (start_vec, end_vec) = if !ipv6 {
                let s_bytes = (start as u32).to_be_bytes().to_vec();
                let e_plus_1 = (end as u32).wrapping_add(1);
                let e_bytes = e_plus_1.to_be_bytes().to_vec();
                (s_bytes, e_bytes)
            } else {
                let s_bytes = start.to_be_bytes().to_vec();
                let e_plus_1 = end.wrapping_add(1);
                let e_bytes = e_plus_1.to_be_bytes().to_vec();
                (s_bytes, e_bytes)
            };

            let start_len = start_vec.len();
            let start_boxed = start_vec.into_boxed_slice();
            let start_ptr = Box::into_raw(start_boxed) as *mut u8;

            let end_len = end_vec.len();
            let end_boxed = end_vec.into_boxed_slice();
            let end_ptr = Box::into_raw(end_boxed) as *mut u8;

            c_intervals.push(CIpInterval {
                start: start_ptr,
                start_len,
                end: end_ptr,
                end_len,
            });
        }

        c_intervals.shrink_to_fit();
        let count = c_intervals.len();
        let boxed_slice = c_intervals.into_boxed_slice();
        let ptr = Box::into_raw(boxed_slice) as *mut CIpInterval;

        CIpIntervalArray {
            intervals: ptr,
            count,
            error: std::ptr::null(),
        }
    });

    match result {
        Ok(arr) => arr,
        Err(_) => CIpIntervalArray {
            intervals: std::ptr::null_mut(),
            count: 0,
            error: string_to_c_char("Internal panic during CIDR merging"),
        },
    }
}

#[no_mangle]
pub extern "C" fn free_intervals(arr: CIpIntervalArray) {
    let _ = catch_unwind(|| unsafe {
        if !arr.error.is_null() {
            let _ = CString::from_raw(arr.error as *mut c_char);
        }

        if !arr.intervals.is_null() && arr.count > 0 {
            let slice = std::slice::from_raw_parts_mut(arr.intervals, arr.count);
            for interval in slice.iter_mut() {
                interval.free_bytes();
            }
            let raw_slice = std::ptr::slice_from_raw_parts_mut(arr.intervals, arr.count);
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

    #[test]
    fn test_parse_and_merge_cidrs_ipv4() {
        let c1 = CString::new("192.168.1.0/24").unwrap();
        let c2 = CString::new("192.168.1.128/25").unwrap();
        let c3 = CString::new("192.168.2.0/24").unwrap();
        let c4 = CString::new("10.0.0.1").unwrap();

        let ptrs = vec![c1.as_ptr(), c2.as_ptr(), c3.as_ptr(), c4.as_ptr()];
        let arr = parse_and_merge_cidrs(ptrs.as_ptr(), ptrs.len(), false);

        assert!(arr.error.is_null());
        assert_eq!(arr.count, 2);

        unsafe {
            let intervals = std::slice::from_raw_parts(arr.intervals, arr.count);

            // First merged interval: 10.0.0.1/32 -> start 10.0.0.1, end+1 10.0.0.2
            let start0 = std::slice::from_raw_parts(intervals[0].start, intervals[0].start_len);
            let end0 = std::slice::from_raw_parts(intervals[0].end, intervals[0].end_len);
            assert_eq!(start0, &[10, 0, 0, 1]);
            assert_eq!(end0, &[10, 0, 0, 2]);

            // Second merged interval: 192.168.1.0/24 + 192.168.2.0/24 -> 192.168.1.0 to 192.168.3.0
            let start1 = std::slice::from_raw_parts(intervals[1].start, intervals[1].start_len);
            let end1 = std::slice::from_raw_parts(intervals[1].end, intervals[1].end_len);
            assert_eq!(start1, &[192, 168, 1, 0]);
            assert_eq!(end1, &[192, 168, 3, 0]);
        }

        free_intervals(arr);
    }

    #[test]
    fn test_parse_and_merge_cidrs_ipv6() {
        let c1 = CString::new("2001:db8::/32").unwrap();
        let ptrs = vec![c1.as_ptr()];
        let arr = parse_and_merge_cidrs(ptrs.as_ptr(), ptrs.len(), true);

        assert!(arr.error.is_null());
        assert_eq!(arr.count, 1);

        unsafe {
            let intervals = std::slice::from_raw_parts(arr.intervals, arr.count);
            assert_eq!(intervals[0].start_len, 16);
            assert_eq!(intervals[0].end_len, 16);
        }

        free_intervals(arr);
    }

    #[test]
    fn test_parse_and_merge_cidrs_null_or_empty() {
        let arr = parse_and_merge_cidrs(std::ptr::null(), 0, false);
        assert_eq!(arr.count, 0);
        assert!(arr.intervals.is_null());
        free_intervals(arr);
    }
}
