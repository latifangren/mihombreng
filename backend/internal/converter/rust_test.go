package converter

import (
	"encoding/base64"
	"testing"
)

func TestParseSubscriptionFallback(t *testing.T) {
	vmessLink := "vmess://eyJ2IjoiMiIsInBzIjoiVGVzdFZNZXNzIiwiYWRkIjoiMS4yLjMuNCIsInBvcnQiOjQ0MywiaWQiOiJhYmMtMTIzIiwibmV0IjoidGNwIiwidHlwZSI6Im5vbmUifQ=="
	vlessLink := "vless://uuid123@5.6.7.8:443?type=tcp#TestVLess"
	trojanLink := "trojan://password123@9.10.11.12:443#TestTrojan"
	ssLink := "ss://YWVzLTI1Ni1nY206cGFzc3dvcmQxMjM@13.14.15.16:8388#TestSS"

	rawContent := vmessLink + "\n" + vlessLink + "\n" + trojanLink + "\n" + ssLink
	encodedContent := base64.StdEncoding.EncodeToString([]byte(rawContent))

	testCases := []struct {
		name    string
		content string
	}{
		{
			name:    "Raw text subscription",
			content: rawContent,
		},
		{
			name:    "Base64 encoded subscription",
			content: encodedContent,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			proxies, err := ParseSubscription(tc.content)
			if err != nil {
				t.Fatalf("unexpected error parsing subscription: %v", err)
			}

			if len(proxies) == 0 {
				t.Fatalf("expected proxies, got none")
			}

			foundTypes := make(map[ProxyType]bool)
			for _, p := range proxies {
				foundTypes[p.Type] = true
			}

			expectedTypes := []ProxyType{ProxyTypeVMess, ProxyTypeVLess, ProxyTypeTrojan, ProxyTypeSS}
			for _, exp := range expectedTypes {
				if !foundTypes[exp] {
					t.Errorf("expected proxy type %s not found in results", exp)
				}
			}
		})
	}
}
