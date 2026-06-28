package backup

import (
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"sync"
	"time"
)

type WebDAVTarget struct {
	config   TargetConfig
	status   SyncStatus
	mu       sync.Mutex
	client   *http.Client
	baseURL  string
}

func NewWebDAVTarget(cfg TargetConfig) *WebDAVTarget {
	return &WebDAVTarget{
		config: cfg,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (t *WebDAVTarget) Name() string {
	return t.config.Name
}

func (t *WebDAVTarget) Type() string {
	return "webdav"
}

func (t *WebDAVTarget) TestConnection() error {
	req, err := t.NewRequest("PROPFIND", t.config.URL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Depth", "0")

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("connection failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		return fmt.Errorf("authentication failed")
	}
	if resp.StatusCode >= 400 {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}
	return nil
}

func (t *WebDAVTarget) Upload(filename string, reader io.Reader) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	uploadURL := t.config.URL + "/" + url.PathEscape(filename)
	req, err := t.NewRequest("PUT", uploadURL, reader)
	if err != nil {
		t.status.LastSyncError = err.Error()
		return err
	}
	req.Header.Set("Content-Type", "application/gzip")

	resp, err := t.client.Do(req)
	if err != nil {
		t.status.LastSyncError = err.Error()
		return fmt.Errorf("upload failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		t.status.LastSyncError = fmt.Sprintf("HTTP %d: %s", resp.StatusCode, string(body))
		return fmt.Errorf("upload failed with status %d", resp.StatusCode)
	}

	t.status.LastSyncTime = time.Now().UTC().Format(time.RFC3339)
	t.status.LastSyncError = ""
	t.status.SyncCount++
	return nil
}

func (t *WebDAVTarget) List() ([]RemoteEntry, error) {
	req, err := t.NewRequest("PROPFIND", t.config.URL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Depth", "1")
	req.Header.Set("Content-Type", "application/xml")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("list failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("list failed with status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	return t.parsePROPFINDResponse(body)
}

func (t *WebDAVTarget) Delete(filename string) error {
	deleteURL := t.config.URL + "/" + url.PathEscape(filename)
	req, err := t.NewRequest("DELETE", deleteURL, nil)
	if err != nil {
		return err
	}

	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("delete failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("delete failed with status %d", resp.StatusCode)
	}
	return nil
}

func (t *WebDAVTarget) GetLastSync() SyncStatus {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.status
}

func (t *WebDAVTarget) NewRequest(method, urlStr string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, urlStr, body)
	if err != nil {
		return nil, err
	}

	if t.config.Username != "" {
		req.SetBasicAuth(t.config.Username, t.config.Password)
	}
	return req, nil
}

type multiStatus struct {
	Responses []davResponse `xml:"response"`
}

type davResponse struct {
	Href     string    `xml:"href"`
	PropStat []propStat `xml:"propstat"`
}

type propStat struct {
	Prop prop `xml:"prop"`
}

type prop struct {
	LastModified string `xml:"getlastmodified"`
	ContentLen   string `xml:"getcontentlength"`
	ResourceType int    `xml:"resourcetype"`
}

func (t *WebDAVTarget) parsePROPFINDResponse(data []byte) ([]RemoteEntry, error) {
	var ms multiStatus
	if err := xml.Unmarshal(data, &ms); err != nil {
		return nil, err
	}

	var entries []RemoteEntry
	for _, r := range ms.Responses {
		href := r.Href
		// Extract filename from href
		href = path.Clean(href)
		parts := strings.Split(href, "/")
		if len(parts) == 0 {
			continue
		}
		filename := parts[len(parts)-1]

		// Skip directories and non-backup files
		if len(r.PropStat) == 0 || !strings.HasSuffix(filename, ".tar.gz") {
			continue
		}

		prop := r.PropStat[0].Prop
		var size int64
		fmt.Sscanf(prop.ContentLen, "%d", &size)

		entries = append(entries, RemoteEntry{
			Filename: filename,
			Size:     size,
			Modified: prop.LastModified,
		})
	}
	return entries, nil
}
