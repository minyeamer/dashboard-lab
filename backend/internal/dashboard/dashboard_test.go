package dashboard

import "testing"

func TestDocumentValidation(t *testing.T) {
	valid := Panel{ID: "one", Type: "table", Title: "Result", SQL: "SELECT 1"}
	for _, tc := range []struct {
		name   string
		panels []Panel
		valid  bool
	}{
		{"empty", []Panel{}, true},
		{"one", []Panel{valid}, true},
		{"duplicate IDs", []Panel{valid, valid}, false},
		{"missing SQL", []Panel{{ID: "one", Type: "table", Title: "Result"}}, false},
		{"unsupported type", []Panel{{ID: "one", Type: "line", Title: "Result", SQL: "SELECT 1"}}, false},
		{"too many", make([]Panel, 21), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := (Document{Title: "Example", Panels: tc.panels}).Validate()
			if (err == nil) != tc.valid {
				t.Fatalf("unexpected validation: %v", err)
			}
		})
	}
}
