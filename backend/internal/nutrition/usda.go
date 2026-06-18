package nutrition

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var ErrUSDAKeyMissing = errors.New("USDA_API_KEY is not configured")

type USDAClient struct {
	apiKey string
	http   *http.Client
}

func NewUSDAClient(apiKey string) *USDAClient {
	return &USDAClient{
		apiKey: strings.TrimSpace(apiKey),
		http: &http.Client{
			Timeout: 12 * time.Second,
		},
	}
}

func (c *USDAClient) Configured() bool {
	return c != nil && c.apiKey != ""
}

type SearchResponse struct {
	Foods []Food `json:"foods"`
}

type Food struct {
	FDCID         int64          `json:"fdcId"`
	Description   string         `json:"description"`
	DataType      string         `json:"dataType"`
	FoodNutrients []FoodNutrient `json:"foodNutrients"`
}

type FoodNutrient struct {
	NutrientID     int64   `json:"nutrientId,omitempty"`
	NutrientName   string  `json:"nutrientName,omitempty"`
	NutrientNumber string  `json:"nutrientNumber,omitempty"`
	UnitName       string  `json:"unitName,omitempty"`
	Value          float64 `json:"value,omitempty"`
}

func (c *USDAClient) SearchFoods(ctx context.Context, query string, pageSize int) (SearchResponse, error) {
	var out SearchResponse
	if !c.Configured() {
		return out, ErrUSDAKeyMissing
	}
	query = strings.TrimSpace(query)
	if query == "" {
		return out, errors.New("query is required")
	}
	if pageSize <= 0 || pageSize > 25 {
		pageSize = 12
	}

	endpoint, _ := url.Parse("https://api.nal.usda.gov/fdc/v1/foods/search")
	values := endpoint.Query()
	values.Set("api_key", c.apiKey)
	values.Set("query", query)
	values.Set("pageSize", fmt.Sprintf("%d", pageSize))
	values.Set("dataType", "Foundation,SR Legacy,Survey (FNDDS),Branded")
	endpoint.RawQuery = values.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint.String(), nil)
	if err != nil {
		return out, err
	}
	req.Header.Set("Accept", "application/json")

	response, err := c.http.Do(req)
	if err != nil {
		return out, err
	}
	defer response.Body.Close()

	if response.StatusCode == http.StatusTooManyRequests {
		return out, errors.New("USDA rate limit reached")
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return out, fmt.Errorf("USDA request failed with status %d", response.StatusCode)
	}
	if err := json.NewDecoder(response.Body).Decode(&out); err != nil {
		return out, err
	}
	return out, nil
}
