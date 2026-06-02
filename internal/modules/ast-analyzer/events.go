package astanalyzer

const (
	TopicASTAnalysisCompleted = "ast-analyzer.analysis_completed"
)

type EventASTAnalysisCompleted struct {
	AssetID   int64  `json:"asset_id"`
	AssetType string `json:"asset_type"`
	AssetPath string `json:"asset_path"`
	Results   string `json:"results"`
}
