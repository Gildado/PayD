#!/bin/bash
# Setup Kibana for PayD
#
# Creates index patterns, dashboards, and visualizations for PayD logs.
#
# Usage: bash docker/setup-kibana.sh

KIBANA_URL="http://localhost:5601"

# Wait for Kibana to be up
until curl -s "$KIBANA_URL/api/status" | grep -q '"state":"green"'; do
  echo "Waiting for Kibana..."
  sleep 5
done

echo "Kibana is up. Creating index patterns..."

# Create index patterns for logs, traces, errors, performance
for pattern in "payd-logs-*" "payd-traces-*" "payd-errors-*" "payd-performance-*" "payd-access-*"; do
  curl -s -X POST "$KIBANA_URL/api/saved_objects/index-pattern" \
    -H 'kbn-xsrf: true' \
    -H 'Content-Type: application/json' \
    -d '{"attributes":{"title":"'$pattern'","timeFieldName":"@timestamp"}}'
done

echo "Index patterns created."

# (Optional) Import dashboards/visualizations here
# curl -X POST "$KIBANA_URL/api/saved_objects/_import" -H 'kbn-xsrf: true' --form file=@dashboard.ndjson

echo "Kibana setup complete."
