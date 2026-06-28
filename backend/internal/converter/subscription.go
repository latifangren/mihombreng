package converter

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

func FetchSubscription(url string) ([]*Proxy, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subscription returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read subscription body: %v", err)
	}

	return ParseSubscription(string(body))
}

var embeddedProxyLinkPattern = regexp.MustCompile(`(?i)(vmess|vless|trojan|ss)://[^\s"'<>]+`)

func ParseSubscription(content string) ([]*Proxy, error) {
	decoded, err := base64.StdEncoding.DecodeString(content)
	if err != nil {
		decoded, err = base64.RawStdEncoding.DecodeString(content)
		if err != nil {
			decoded = []byte(content)
		}
	}

	parsedContent := string(decoded)
	links := extractSubscriptionLinks(parsedContent)
	if len(links) == 0 && string(decoded) != content {
		links = extractSubscriptionLinks(content)
	}

	return ParseLinks(links)
}

func extractSubscriptionLinks(content string) []string {
	lines := strings.Split(content, "\n")
	links := make([]string, 0)
	seen := make(map[string]struct{})

	appendLink := func(link string) {
		link = strings.TrimSpace(link)
		if link == "" {
			return
		}
		if _, ok := seen[link]; ok {
			return
		}
		seen[link] = struct{}{}
		links = append(links, link)
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "vmess://") || strings.HasPrefix(line, "vless://") || strings.HasPrefix(line, "trojan://") || strings.HasPrefix(line, "ss://") {
			appendLink(line)
			continue
		}
		for _, match := range embeddedProxyLinkPattern.FindAllString(line, -1) {
			appendLink(match)
		}
	}

	return links
}
