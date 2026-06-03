package jxscout

import (
	"log/slog"
	"regexp"

	"github.com/francisconeves97/jxscout/internal/core/common"
	jxscouttypes "github.com/francisconeves97/jxscout/pkg/types"
)

type scopeChecker struct {
	scope        []string
	scopeExclude []string
	log          *slog.Logger
}

func newScopeChecker(scope []string, scopeExclude []string, log *slog.Logger) jxscouttypes.Scope {
	return &scopeChecker{
		scope:        scope,
		scopeExclude: scopeExclude,
		log:          log,
	}
}

func (s *scopeChecker) IsInScope(url string) bool {
	normalizedURL := common.NormalizeURL(url)

	matchesList := func(patterns []string) bool {
		for _, regex := range patterns {
			match, err := regexp.Match(regex, []byte(normalizedURL))
			if err != nil {
				s.log.Error("failed to match regex", "regex", regex, "url", normalizedURL, "err", err)
				continue
			}

			if match {
				return true
			}
		}
		return false
	}

	hasWhite := len(s.scope) > 0
	hasBlack := len(s.scopeExclude) > 0

	if !hasWhite && !hasBlack {
		return true
	}

	if hasBlack && matchesList(s.scopeExclude) {
		s.log.Debug("request matched exclude regex, filtering out of scope", "url", normalizedURL)
		return false
	}

	if hasWhite {
		return matchesList(s.scope)
	}

	return true
}

func initializeScope(patterns []string) []string {
	scopeRegex := []string{}

	for _, url := range patterns {
		scopeRegex = append(scopeRegex, wildCardToRegexp(url))
	}

	return scopeRegex
}
