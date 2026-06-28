package subscription

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	proxylib "mihombreng/internal/converter"
)

type Subscription struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	URL              string `json:"url"`
	ProviderFilename string `json:"provider_filename"`
	ProviderPath     string `json:"provider_path"`
	UpdateInterval   int    `json:"update_interval"`
	Enabled          bool   `json:"enabled"`
	Status           string `json:"status"`
	LastRefreshAt    string `json:"last_refresh_at,omitempty"`
	LastSuccessAt    string `json:"last_success_at,omitempty"`
	LastError        string `json:"last_error,omitempty"`
	ProxyCount       int    `json:"proxy_count"`
	CreatedAt        string `json:"created_at"`
	UpdatedAt        string `json:"updated_at"`
}

type CreateInput struct {
	Name             string `json:"name"`
	URL              string `json:"url"`
	ProviderFilename string `json:"provider_filename"`
	UpdateInterval   int    `json:"update_interval"`
	Enabled          bool   `json:"enabled"`
}

type UpdateInput struct {
	Name             string `json:"name"`
	URL              string `json:"url"`
	ProviderFilename string `json:"provider_filename"`
	UpdateInterval   int    `json:"update_interval"`
	Enabled          bool   `json:"enabled"`
}

type Service struct {
	mu          sync.Mutex
	storePath   string
	workingDir  string
	providerDir string
}

func NewService(workingDir string) *Service {
	return &Service{
		storePath:   filepath.Join(workingDir, "subscriptions.json"),
		workingDir:  workingDir,
		providerDir: filepath.Join(workingDir, "proxy_providers"),
	}
}

func (s *Service) List() ([]Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.load()
	if err != nil {
		return nil, err
	}
	sort.Slice(items, func(i, j int) bool {
		return items[i].CreatedAt > items[j].CreatedAt
	})
	return items, nil
}

func (s *Service) Get(id string) (*Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.load()
	if err != nil {
		return nil, err
	}
	idx := s.findIndex(items, id)
	if idx < 0 {
		return nil, fmt.Errorf("subscription not found")
	}
	item := items[idx]
	return &item, nil
}

func (s *Service) Create(input CreateInput) (*Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	items, err := s.load()
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	providerFilename := normalizeFilename(input.ProviderFilename)
	if providerFilename == "" {
		providerFilename = slugify(input.Name) + ".yaml"
	}
	item := Subscription{
		ID:               fmt.Sprintf("sub_%d", time.Now().UnixNano()),
		Name:             strings.TrimSpace(input.Name),
		URL:              strings.TrimSpace(input.URL),
		ProviderFilename: providerFilename,
		ProviderPath:     filepath.ToSlash(filepath.Join("proxy_providers", providerFilename)),
		UpdateInterval:   normalizeInterval(input.UpdateInterval),
		Enabled:          input.Enabled,
		Status:           "draft",
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if err := s.validate(item, items, ""); err != nil {
		return nil, err
	}
	if err := s.writeProviderFile(item); err != nil {
		return nil, err
	}
	items = append(items, item)
	if err := s.save(items); err != nil {
		return nil, err
	}

	if _, err := s.refreshLocked(items, item.ID); err == nil {
		items, _ = s.load()
		idx := s.findIndex(items, item.ID)
		if idx >= 0 {
			item = items[idx]
		}
	}

	return &item, nil
}

func (s *Service) Update(id string, input UpdateInput) (*Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.load()
	if err != nil {
		return nil, err
	}
	idx := s.findIndex(items, id)
	if idx < 0 {
		return nil, fmt.Errorf("subscription not found")
	}

	current := items[idx]
	updated := current
	updated.Name = strings.TrimSpace(input.Name)
	updated.URL = strings.TrimSpace(input.URL)
	updated.Enabled = input.Enabled
	updated.UpdateInterval = normalizeInterval(input.UpdateInterval)
	providerFilename := normalizeFilename(input.ProviderFilename)
	if providerFilename == "" {
		providerFilename = current.ProviderFilename
	}
	updated.ProviderFilename = providerFilename
	updated.ProviderPath = filepath.ToSlash(filepath.Join("proxy_providers", providerFilename))
	updated.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := s.validate(updated, items, id); err != nil {
		return nil, err
	}
	if current.ProviderFilename != updated.ProviderFilename {
		oldPath := filepath.Join(s.providerDir, current.ProviderFilename)
		_ = os.Remove(oldPath)
	}
	if err := s.writeProviderFile(updated); err != nil {
		return nil, err
	}
	items[idx] = updated
	if err := s.save(items); err != nil {
		return nil, err
	}
	return &updated, nil
}

func (s *Service) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.load()
	if err != nil {
		return err
	}
	idx := s.findIndex(items, id)
	if idx < 0 {
		return fmt.Errorf("subscription not found")
	}
	item := items[idx]
	items = append(items[:idx], items[idx+1:]...)
	if err := s.save(items); err != nil {
		return err
	}
	_ = os.Remove(filepath.Join(s.providerDir, item.ProviderFilename))
	return nil
}

func (s *Service) Refresh(id string) (*Subscription, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	items, err := s.load()
	if err != nil {
		return nil, err
	}
	return s.refreshLocked(items, id)
}

func (s *Service) refreshLocked(items []Subscription, id string) (*Subscription, error) {
	idx := s.findIndex(items, id)
	if idx < 0 {
		return nil, fmt.Errorf("subscription not found")
	}
	item := items[idx]
	item.LastRefreshAt = time.Now().UTC().Format(time.RFC3339)
	item.UpdatedAt = item.LastRefreshAt

	count, err := s.fetchProxyCount(item.URL)
	if err != nil {
		item.Status = "error"
		item.LastError = err.Error()
		items[idx] = item
		if saveErr := s.save(items); saveErr != nil {
			return nil, saveErr
		}
		return &item, nil
	}

	item.ProxyCount = count
	item.Status = "healthy"
	item.LastError = ""
	item.LastSuccessAt = item.LastRefreshAt
	if err := s.writeProviderFile(item); err != nil {
		return nil, err
	}
	items[idx] = item
	if err := s.save(items); err != nil {
		return nil, err
	}
	return &item, nil
}

func (s *Service) fetchProxyCount(url string) (int, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch subscription: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("subscription returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, fmt.Errorf("failed to read subscription body: %w", err)
	}
	proxies, err := proxylib.ParseSubscription(string(body))
	if err != nil {
		return 0, fmt.Errorf("failed to parse subscription: %w", err)
	}
	return len(proxies), nil
}

func (s *Service) writeProviderFile(item Subscription) error {
	if err := os.MkdirAll(s.providerDir, 0755); err != nil {
		return err
	}
	content := fmt.Sprintf("type: http\nurl: %s\npath: ./proxy_providers/%s\ninterval: %d\nhealth-check:\n  enable: true\n  url: https://cp.cloudflare.com/generate_204\n  interval: 600\n",
		item.URL,
		item.ProviderFilename,
		item.UpdateInterval,
	)
	return os.WriteFile(filepath.Join(s.providerDir, item.ProviderFilename), []byte(content), 0644)
}

func (s *Service) validate(item Subscription, existing []Subscription, selfID string) error {
	if item.Name == "" {
		return fmt.Errorf("name is required")
	}
	if item.URL == "" {
		return fmt.Errorf("url is required")
	}
	if !strings.HasPrefix(item.URL, "http://") && !strings.HasPrefix(item.URL, "https://") {
		return fmt.Errorf("url must start with http:// or https://")
	}
	if item.ProviderFilename == "" || !strings.HasSuffix(item.ProviderFilename, ".yaml") && !strings.HasSuffix(item.ProviderFilename, ".yml") {
		return fmt.Errorf("provider filename must end with .yaml or .yml")
	}
	for _, existingItem := range existing {
		if existingItem.ID == selfID {
			continue
		}
		if strings.EqualFold(existingItem.Name, item.Name) {
			return fmt.Errorf("subscription name already exists")
		}
		if strings.EqualFold(existingItem.ProviderFilename, item.ProviderFilename) {
			return fmt.Errorf("provider filename already exists")
		}
	}
	return nil
}

func (s *Service) load() ([]Subscription, error) {
	if _, err := os.Stat(s.storePath); os.IsNotExist(err) {
		return []Subscription{}, nil
	}
	data, err := os.ReadFile(s.storePath)
	if err != nil {
		return nil, err
	}
	var items []Subscription
	if len(data) == 0 {
		return []Subscription{}, nil
	}
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, err
	}
	return items, nil
}

func (s *Service) save(items []Subscription) error {
	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.storePath, data, 0644)
}

func (s *Service) findIndex(items []Subscription, id string) int {
	for idx, item := range items {
		if item.ID == id {
			return idx
		}
	}
	return -1
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	value = slugRe.ReplaceAllString(value, "-")
	value = strings.Trim(value, "-")
	if value == "" {
		return "subscription"
	}
	return value
}

func normalizeFilename(value string) string {
	value = strings.TrimSpace(filepath.Base(value))
	if value == "" {
		return ""
	}
	if !strings.HasSuffix(value, ".yaml") && !strings.HasSuffix(value, ".yml") {
		value += ".yaml"
	}
	return value
}

func normalizeInterval(value int) int {
	if value <= 0 {
		return 3600
	}
	return value
}
