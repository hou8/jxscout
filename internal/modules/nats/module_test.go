package nats

import (
	"strings"
	"testing"
	"unicode/utf8"

	"github.com/stretchr/testify/assert"
)

func TestTruncateValue_NoTruncation(t *testing.T) {
	input := "short value"
	output := truncateValue(input)
	assert.Equal(t, input, output)

	// Exactly at threshold (500K characters)
	inputAtThreshold := strings.Repeat("a", maxRuneLength)
	outputAtThreshold := truncateValue(inputAtThreshold)
	assert.Equal(t, inputAtThreshold, outputAtThreshold)
}

func TestTruncateValue_Truncation(t *testing.T) {
	// Exceeds threshold (500K + 10 characters)
	inputExceeded := strings.Repeat("a", maxRuneLength+10)
	outputExceeded := truncateValue(inputExceeded)

	runesOutput := []rune(outputExceeded)
	assert.True(t, len(runesOutput) == maxRuneLength+len([]rune("... [truncated]")), "Output character length should match expected length")
	assert.True(t, strings.HasSuffix(outputExceeded, "... [truncated]"), "Output should have truncation suffix")

	expectedContent := strings.Repeat("a", maxRuneLength) + "... [truncated]"
	assert.Equal(t, expectedContent, outputExceeded)
}

func TestTruncateValue_UTF8Safety(t *testing.T) {
	// Exceeds threshold with multi-byte characters
	// 500K characters + 1 Chinese character
	input := strings.Repeat("中", maxRuneLength+1)
	output := truncateValue(input)

	assert.True(t, utf8.ValidString(output), "Output string must be valid UTF-8")
	runesOutput := []rune(output)
	assert.True(t, len(runesOutput) == maxRuneLength+len([]rune("... [truncated]")))
	
	expected := strings.Repeat("中", maxRuneLength) + "... [truncated]"
	assert.Equal(t, expected, output)
}
