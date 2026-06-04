package nats

import (
	"context"
	"encoding/json"
	"time"

	"github.com/francisconeves97/jxscout/internal/core/common"
	"github.com/francisconeves97/jxscout/internal/core/dbeventbus"
	"github.com/francisconeves97/jxscout/internal/core/errutil"
	"github.com/francisconeves97/jxscout/internal/modules/ast-analyzer"
	jxscouttypes "github.com/francisconeves97/jxscout/pkg/types"
	"github.com/nats-io/nats.go"
)

type NatsModule struct {
	sdk *jxscouttypes.ModuleSDK
	nc  *nats.Conn
}

func NewNatsModule() *NatsModule {
	return &NatsModule{}
}

type NatsMessageResult struct {
	Analyzer string               `json:"analyzer"`
	Value    string               `json:"value"`
	Start    astanalyzer.Position `json:"start"`
	End      astanalyzer.Position `json:"end"`
	Tags     map[string]bool      `json:"tags"`
	Extra    map[string]any       `json:"extra,omitempty"`
}

type NatsMessage struct {
	ProjectName   string              `json:"project_name"`
	AssetID       int64               `json:"asset_id"`
	AssetPath     string              `json:"asset_path"`
	AssetType     string              `json:"asset_type"`
	CapturedTypes []string            `json:"captured_types"`
	CreatedAt     time.Time           `json:"created_at"`
	Results       []NatsMessageResult `json:"results"`
}

type tempMatch struct {
	FilePath     string               `json:"filePath"`
	AnalyzerName string               `json:"analyzerName"`
	Value        string               `json:"value"`
	Start        astanalyzer.Position `json:"start"`
	End          astanalyzer.Position `json:"end"`
	Tags         map[string]bool      `json:"tags"`
	Extra        map[string]any       `json:"extra"`
}

func (m *NatsModule) Initialize(sdk *jxscouttypes.ModuleSDK) error {
	m.sdk = sdk

	if !sdk.Options.NatsEnabled {
		sdk.Logger.Debug("NATS integration is disabled, skipping")
		return nil
	}

	sdk.Logger.Info("Initializing NATS integration", "url", sdk.Options.NatsURL)
	nc, err := nats.Connect(sdk.Options.NatsURL)
	if err != nil {
		return errutil.Wrapf(err, "failed to connect to NATS at %s", sdk.Options.NatsURL)
	}
	m.nc = nc

	// Subscribe to TopicASTAnalysisCompleted
	err = sdk.DBEventBus.Subscribe(
		sdk.Ctx,
		astanalyzer.TopicASTAnalysisCompleted,
		"nats-publisher",
		m.handleAnalysisCompleted,
		dbeventbus.Options{
			Concurrency:       1,
			MaxRetries:        3,
			Backoff:           common.ExponentialBackoff,
			PollInterval:      1 * time.Second,
			HeartbeatInterval: 10 * time.Second,
		},
	)
	if err != nil {
		return errutil.Wrap(err, "failed to subscribe to AST analysis completed topic")
	}

	// Graceful shutdown
	go func() {
		<-sdk.Ctx.Done()
		sdk.Logger.Info("Shutting down NATS connection")
		nc.Close()
	}()

	return nil
}

func (m *NatsModule) handleAnalysisCompleted(ctx context.Context, payload []byte) error {
	var event astanalyzer.EventASTAnalysisCompleted
	if err := json.Unmarshal(payload, &event); err != nil {
		return errutil.Wrap(err, "failed to unmarshal EventASTAnalysisCompleted payload")
	}

	var rawMatches []tempMatch
	if err := json.Unmarshal([]byte(event.Results), &rawMatches); err != nil {
		return errutil.Wrap(err, "failed to unmarshal analysis results string")
	}

	results := make([]NatsMessageResult, 0, len(rawMatches))
	capturedTypesSet := make(map[string]bool)

	for _, match := range rawMatches {
		results = append(results, NatsMessageResult{
			Analyzer: match.AnalyzerName,
			Value:    truncateValue(match.Value),
			Start:    match.Start,
			End:      match.End,
			Tags:     match.Tags,
			Extra:    match.Extra,
		})
		if match.AnalyzerName != "" {
			capturedTypesSet[match.AnalyzerName] = true
		}
	}

	capturedTypes := make([]string, 0, len(capturedTypesSet))
	for t := range capturedTypesSet {
		capturedTypes = append(capturedTypes, t)
	}

	msg := NatsMessage{
		ProjectName:   m.sdk.Options.ProjectName,
		AssetID:       event.AssetID,
		AssetPath:     event.AssetPath,
		AssetType:     event.AssetType,
		CapturedTypes: capturedTypes,
		CreatedAt:     time.Now().UTC(),
		Results:       results,
	}

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return errutil.Wrap(err, "failed to marshal NATS message payload")
	}

	m.sdk.Logger.Debug("Publishing AST analysis results to NATS", "asset_id", event.AssetID, "subject", "jxscout.ast.analysis", "size", len(msgBytes))
	if err := m.nc.Publish("jxscout.ast.analysis", msgBytes); err != nil {
		return dbeventbus.NewRetriableError(errutil.Wrap(err, "failed to publish message to NATS"))
	}

	return nil
}

const maxRuneLength = 500000

func truncateValue(val string) string {
	runes := []rune(val)
	if len(runes) <= maxRuneLength {
		return val
	}
	return string(runes[:maxRuneLength]) + "... [truncated]"
}
