//go:build cgo

package converter

/*
#include <stdlib.h>
#include <stdbool.h>

typedef struct {
    char* name;
    char* proxy_type;
    char* raw;
    char* server;
    unsigned short port;
    char* uuid;
    char* password;
    char* cipher;
    bool udp;
    bool tls;
    char* sni;
    char* network;
    char* ws_path;
    char* flow;
    bool skip_cert_verify;
} CProxy;

typedef struct {
    CProxy* proxies;
    size_t count;
    const char* error;
} CProxyArray;

CProxyArray parse_subscription_payload(const char* input);
void free_proxy_array(CProxyArray arr);
*/
import "C"

import (
	"fmt"
	"unsafe"
)

func ParseSubscriptionRust(content string) ([]*Proxy, error) {
	cStr := C.CString(content)
	defer C.free(unsafe.Pointer(cStr))

	res := C.parse_subscription_payload(cStr)
	defer C.free_proxy_array(res)

	if res.error != nil {
		return nil, fmt.Errorf("rust parser error: %s", C.GoString(res.error))
	}

	if res.count == 0 || res.proxies == nil {
		return []*Proxy{}, nil
	}

	cProxies := unsafe.Slice(res.proxies, int(res.count))
	proxies := make([]*Proxy, 0, int(res.count))

	for _, cp := range cProxies {
		p := &Proxy{
			Name:           C.GoString(cp.name),
			Type:           ProxyType(C.GoString(cp.proxy_type)),
			Raw:            C.GoString(cp.raw),
			Server:         C.GoString(cp.server),
			Port:           int(cp.port),
			UUID:           C.GoString(cp.uuid),
			Password:       C.GoString(cp.password),
			Cipher:         C.GoString(cp.cipher),
			UDP:            bool(cp.udp),
			TLS:            bool(cp.tls),
			SNI:            C.GoString(cp.sni),
			Network:        C.GoString(cp.network),
			WSPath:         C.GoString(cp.ws_path),
			Flow:           C.GoString(cp.flow),
			SkipCertVerify: bool(cp.skip_cert_verify),
		}
		proxies = append(proxies, p)
	}

	return proxies, nil
}

func IsRustAvailable() bool {
	return true
}
