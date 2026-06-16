#!/usr/bin/env bash

set -euo pipefail

usage() {
  printf 'Usage: %s <prd-issue-number> <iterations>\n' "$0" >&2
}

if [ "$#" -ne 2 ]; then
  usage
  exit 1
fi

prd_issue="$1"
iterations="$2"

if ! [[ "$prd_issue" =~ ^[0-9]+$ ]]; then
  printf 'PRD issue number must be numeric.\n' >&2
  usage
  exit 1
fi

if ! [[ "$iterations" =~ ^[0-9]+$ ]] || [ "$iterations" -lt 1 ]; then
  printf 'Iterations must be a positive integer.\n' >&2
  usage
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  printf 'The gh CLI is required.\n' >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  printf 'jq is required.\n' >&2
  exit 1
fi

repo="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
prd_url="https://github.com/${repo}/issues/${prd_issue}"

issue_context() {
  prd_json="$(gh issue view "$prd_issue" --json number,title,state,body,labels,comments,url)"
  task_json="$(gh issue list \
    --state open \
    --search "repo:${repo} ${prd_url} OR #${prd_issue}" \
    --json number,title,state,body,labels,url \
    --limit 100)"

  jq -n \
    --argjson prd "$prd_json" \
    --argjson tasks "$task_json" \
    --arg prd_issue "$prd_issue" \
    --arg prd_url "$prd_url" \
    '
      def labels: [.labels[].name] | join(", ");

      "# PRD Issue\n" +
      "#" + ($prd.number | tostring) + " " + $prd.title + "\n" +
      "State: " + $prd.state + "\n" +
      "Labels: " + ($prd | labels) + "\n" +
      "URL: " + $prd.url + "\n\n" +
      ($prd.body // "") + "\n\n" +
      "# PRD Comments\n" +
      (if ($prd.comments | length) == 0 then
        "No comments.\n"
      else
        ($prd.comments | map("- " + (.author.login // "unknown") + ": " + (.body // "")) | join("\n\n")) + "\n"
      end) +
      "\n# Connected Open Task Issues\n" +
      (if ($tasks | map(select(.number != ($prd_issue | tonumber))) | length) == 0 then
        "No open task issues found by searching for " + $prd_url + " or #" + $prd_issue + ".\n"
      else
        ($tasks
          | map(select(.number != ($prd_issue | tonumber)))
          | sort_by(.number)
          | map(
              "## #" + (.number | tostring) + " " + .title + "\n" +
              "State: " + .state + "\n" +
              "Labels: " + (. | labels) + "\n" +
              "URL: " + .url + "\n\n" +
              (.body // "")
            )
          | join("\n\n")) + "\n"
      end)
    '
}

for ((i = 1; i <= iterations; i++)); do
  context="$(issue_context)"

  result="$(opencode --model openai/gpt-5.5-fast run "
${context}

You are working in ${repo}.

1. Decide which connected open task issue to work on next from the Connected Open Task Issues section.
This should be the one YOU decide has the highest priority, not necessarily the first in the list.
2. Read the selected task issue and PRD issue directly with gh before editing.
3. Check feedback loops, such as types and tests.
4. Add a progress comment to the selected task issue.
5. Update the selected task issue status by closing it if complete, or leaving a precise progress comment if incomplete.
6. Make a git commit for that feature.

ONLY WORK ON A SINGLE TASK / FEATURE.
If all connected task issues for PRD #${prd_issue} are complete, output <promise>COMPLETE</promise>.
")"

  printf '%s\n' "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    printf 'PRD complete, exiting.\n'
    exit 0
  fi
done
