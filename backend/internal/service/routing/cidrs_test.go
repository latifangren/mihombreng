package routing

import (
	"bytes"
	"testing"
)

func TestBuildReservedSetElements(t *testing.T) {
	cidrs := []string{
		"192.168.1.0/24",
		"192.168.2.0/24",
		"10.0.0.1/32",
	}

	elements := buildReservedSetElements(cidrs, false)
	if len(elements) != 4 {
		t.Fatalf("expected 4 set elements (2 intervals), got %d", len(elements))
	}

	// First interval: 10.0.0.1 - 10.0.0.2
	if !bytes.Equal(elements[0].Key, []byte{10, 0, 0, 1}) {
		t.Errorf("unexpected start key 0: %v", elements[0].Key)
	}
	if !elements[1].IntervalEnd || !bytes.Equal(elements[1].Key, []byte{10, 0, 0, 2}) {
		t.Errorf("unexpected end key 1: %v", elements[1].Key)
	}

	// Second merged interval: 192.168.1.0 - 192.168.3.0
	if !bytes.Equal(elements[2].Key, []byte{192, 168, 1, 0}) {
		t.Errorf("unexpected start key 2: %v", elements[2].Key)
	}
	if !elements[3].IntervalEnd || !bytes.Equal(elements[3].Key, []byte{192, 168, 3, 0}) {
		t.Errorf("unexpected end key 3: %v", elements[3].Key)
	}
}
