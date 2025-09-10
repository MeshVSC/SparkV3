#!/bin/bash
npm ci, run npx tsc 
echo "🔍 Running TypeScript error check..."
echo "=================================="

# Run tsc and capture output
output=$(npx tsc --noEmit 2>&1)

# Count errors
error_count=$(echo "$output" | grep -c "error TS")

# Display results
if [ $error_count -eq 0 ]; then
    echo "✅ No TypeScript errors found!"
else
    echo "❌ Found $error_count TypeScript errors"
fi

echo "=================================="

# Optionally show the errors (uncomment next line if you want to see them)
# echo "$output"

exit 0
