package astanalyzer

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestFormatMatchesV1(t *testing.T) {
	tests := []struct {
		name     string
		matches  []AnalyzerMatch
		expected []ASTAnalyzerTreeNode
	}{
		{
			name:     "empty matches returns empty list",
			matches:  []AnalyzerMatch{},
			expected: []ASTAnalyzerTreeNode{},
		},
		{
			name: "single path match",
			matches: []AnalyzerMatch{
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "/api/users",
					Tags:         map[string]bool{"is-path-only": true},
				},
			},
			expected: []ASTAnalyzerTreeNode{
				{
					Label:       "Data",
					Description: "[1]",
					IconName:    "resources:data",
					Type:        ASTAnalyzerTreeNodeTypeNavigation,
					Children: []ASTAnalyzerTreeNode{
						{
							Label:       "Paths",
							Description: "[1]",
							IconName:    "resources:path",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Label:       "Paths",
									Description: "[1]",
									IconName:    "resources:path",
									Type:        ASTAnalyzerTreeNodeTypeNavigation,
									Children: []ASTAnalyzerTreeNode{
										{
											Type:        ASTAnalyzerTreeNodeTypeMatch,
											Label:       "/api/users",
											Description: "",
											IconName:    "resources:path",
											Data: AnalyzerMatch{
												FilePath:     "test.go",
												AnalyzerName: "test",
												Value:        "/api/users",
												Tags:         map[string]bool{"is-path-only": true},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "extension with other tag",
			matches: []AnalyzerMatch{
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "asd.js",
					Tags:         map[string]bool{"is-extension": true, "extension-js": true},
				},
			},
			expected: []ASTAnalyzerTreeNode{
				{
					Label:       "Data",
					Description: "[1]",
					IconName:    "resources:data",
					Type:        ASTAnalyzerTreeNodeTypeNavigation,
					Children: []ASTAnalyzerTreeNode{
						{
							Label:       "Extensions",
							Description: "[1]",
							IconName:    "resources:extension",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Label:       "js",
									Description: "[1]",
									IconName:    "resources:extension",
									Type:        ASTAnalyzerTreeNodeTypeNavigation,
									Children: []ASTAnalyzerTreeNode{
										{
											Type:        ASTAnalyzerTreeNodeTypeMatch,
											Label:       "asd.js",
											Description: "",
											IconName:    "resources:extension",
											Data: AnalyzerMatch{
												FilePath:     "test.go",
												AnalyzerName: "test",
												Value:        "asd.js",
												Tags:         map[string]bool{"extension-js": true, "is-extension": true},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "iframe communication",
			matches: []AnalyzerMatch{
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "window.postMessage",
					Tags:         map[string]bool{"postMessage": true},
				},
			},
			expected: []ASTAnalyzerTreeNode{
				{
					Label:       "Client Behavior",
					Description: "[1]",
					IconName:    "resources:javascript",
					Type:        ASTAnalyzerTreeNodeTypeNavigation,
					Children: []ASTAnalyzerTreeNode{
						{
							Label:       "Events",
							Description: "[1]",
							IconName:    "resources:event",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Label:       "postMessage",
									Description: "[1]",
									IconName:    "resources:postmessage",
									Type:        ASTAnalyzerTreeNodeTypeNavigation,
									Children: []ASTAnalyzerTreeNode{
										{
											Type:        ASTAnalyzerTreeNodeTypeMatch,
											Label:       "window.postMessage",
											Description: "",
											IconName:    "resources:postmessage",
											Data: AnalyzerMatch{
												FilePath:     "test.go",
												AnalyzerName: "test",
												Value:        "window.postMessage",
												Tags:         map[string]bool{"postMessage": true},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "storage manipulation",
			matches: []AnalyzerMatch{
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "document.cookie",
					Tags:         map[string]bool{"cookie": true, "cookie-assignment": true},
				},
			},
			expected: []ASTAnalyzerTreeNode{
				{
					Label:       "Client Behavior",
					Description: "[1]",
					IconName:    "resources:javascript",
					Type:        ASTAnalyzerTreeNodeTypeNavigation,
					Children: []ASTAnalyzerTreeNode{
						{
							Label:       "Storage",
							Description: "[1]",
							IconName:    "resources:storage",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Label:       "Cookie",
									Description: "[1]",
									IconName:    "resources:cookie",
									Type:        ASTAnalyzerTreeNodeTypeNavigation,
									Children: []ASTAnalyzerTreeNode{
										{
											Label:       "Assignment",
											Description: "[1]",
											IconName:    "resources:cookie",
											Type:        ASTAnalyzerTreeNodeTypeNavigation,
											Children: []ASTAnalyzerTreeNode{
												{
													Type:        ASTAnalyzerTreeNodeTypeMatch,
													Label:       "document.cookie",
													Description: "",
													IconName:    "resources:cookie",
													Data: AnalyzerMatch{
														FilePath:     "test.go",
														AnalyzerName: "test",
														Value:        "document.cookie",
														Tags:         map[string]bool{"cookie": true, "cookie-assignment": true},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name: "behavior with misc",
			matches: []AnalyzerMatch{
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "window.location.hash",
					Tags:         map[string]bool{"onhashchange": true},
				},
				{
					FilePath:     "test.go",
					AnalyzerName: "test",
					Value:        "document.write",
					Tags:         map[string]bool{"inner-html": true},
				},
			},
			expected: []ASTAnalyzerTreeNode{
				{
					Label:       "Client Behavior",
					Description: "[2]",
					IconName:    "resources:javascript",
					Type:        ASTAnalyzerTreeNodeTypeNavigation,
					Children: []ASTAnalyzerTreeNode{
						{
							Label:       "Events",
							Description: "[1]",
							IconName:    "resources:event",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Label:       "onhashchange",
									Description: "[1]",
									IconName:    "resources:event",
									Type:        ASTAnalyzerTreeNodeTypeNavigation,
									Children: []ASTAnalyzerTreeNode{
										{
											Type:        ASTAnalyzerTreeNodeTypeMatch,
											Label:       "window.location.hash",
											Description: "",
											IconName:    "resources:event",
											Data: AnalyzerMatch{
												FilePath:     "test.go",
												AnalyzerName: "test",
												Value:        "window.location.hash",
												Tags:         map[string]bool{"onhashchange": true},
											},
										},
									},
								},
							},
						},
						{
							Label:       "innerHTML",
							Description: "[1]",
							IconName:    "resources:javascript",
							Type:        ASTAnalyzerTreeNodeTypeNavigation,
							Children: []ASTAnalyzerTreeNode{
								{
									Type:        ASTAnalyzerTreeNodeTypeMatch,
									Label:       "document.write",
									Description: "",
									IconName:    "resources:javascript",
									Data: AnalyzerMatch{
										FilePath:     "test.go",
										AnalyzerName: "test",
										Value:        "document.write",
										Tags:         map[string]bool{"inner-html": true},
									},
								},
							},
						},
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := formatMatchesV1(tt.matches)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestFormatMatchesV1WithExampleData(t *testing.T) {
	matchesJSON, err := os.ReadFile("example/matches.json")
	if err != nil {
		t.Fatalf("Failed to read matches.json: %v", err)
	}

	var matches []AnalyzerMatch
	if err := json.Unmarshal(matchesJSON, &matches); err != nil {
		t.Fatalf("Failed to unmarshal matches.json: %v", err)
	}

	result := formatMatchesV1(matches)

	assert.NotNil(t, result)
	assert.NotEmpty(t, result)

	totalMatches := 0
	var countMatches func(node ASTAnalyzerTreeNode)
	countMatches = func(node ASTAnalyzerTreeNode) {
		if node.Type == ASTAnalyzerTreeNodeTypeMatch {
			totalMatches++
		}
		for _, child := range node.Children {
			countMatches(child)
		}
	}
	for _, rootNode := range result {
		countMatches(rootNode)
	}

	assert.Equal(t, 2, totalMatches, "Expected 2 matches in the result")

	categories := make(map[string]bool)
	var collectCategories func(node ASTAnalyzerTreeNode)
	collectCategories = func(node ASTAnalyzerTreeNode) {
		if node.Type == ASTAnalyzerTreeNodeTypeNavigation {
			categories[node.Label] = true
		}
		for _, child := range node.Children {
			collectCategories(child)
		}
	}
	for _, rootNode := range result {
		collectCategories(rootNode)
	}

	expectedCategories := []string{"Data", "Client Behavior"}
	for _, category := range expectedCategories {
		assert.True(t, categories[category], "Expected category %s to be present", category)
	}
}
