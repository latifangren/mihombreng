//go:build cgo && rust_ffi

package routing

/*
#cgo LDFLAGS: -L${SRCDIR}/../../../../crates/mihombreng-converter/target/release -lmihombreng_converter
#include <stdlib.h>
#include <stdbool.h>

typedef struct {
    uint8_t* start;
    size_t start_len;
    uint8_t* end;
    size_t end_len;
} CIpInterval;

typedef struct {
    CIpInterval* intervals;
    size_t count;
    const char* error;
} CIpIntervalArray;

CIpIntervalArray parse_and_merge_cidrs(const char* const* input_cidrs, size_t count, bool ipv6);
void free_intervals(CIpIntervalArray arr);
*/
import "C"

import (
	"fmt"
	"unsafe"

	"github.com/sagernet/nftables"
)

func ParseAndMergeCIDRsRust(cidrs []string, ipv6 bool) ([]nftables.SetElement, error) {
	if len(cidrs) == 0 {
		return []nftables.SetElement{}, nil
	}

	cStrings := make([]*C.char, len(cidrs))
	for i, s := range cidrs {
		cStrings[i] = C.CString(s)
		defer C.free(unsafe.Pointer(cStrings[i]))
	}

	res := C.parse_and_merge_cidrs((**C.char)(unsafe.Pointer(&cStrings[0])), C.size_t(len(cidrs)), C.bool(ipv6))
	defer C.free_intervals(res)

	if res.error != nil {
		return nil, fmt.Errorf("rust cidr merger error: %s", C.GoString(res.error))
	}

	if res.count == 0 || res.intervals == nil {
		return []nftables.SetElement{}, nil
	}

	cIntervals := unsafe.Slice(res.intervals, int(res.count))
	elements := make([]nftables.SetElement, 0, int(res.count)*2)

	for _, ci := range cIntervals {
		if ci.start == nil || ci.start_len == 0 || ci.end == nil || ci.end_len == 0 {
			continue
		}
		startBytes := C.GoBytes(unsafe.Pointer(ci.start), C.int(ci.start_len))
		endBytes := C.GoBytes(unsafe.Pointer(ci.end), C.int(ci.end_len))

		elements = append(elements,
			nftables.SetElement{Key: startBytes},
			nftables.SetElement{Key: endBytes, IntervalEnd: true},
		)
	}

	return elements, nil
}

func IsRustCIDRMergerAvailable() bool {
	return true
}
