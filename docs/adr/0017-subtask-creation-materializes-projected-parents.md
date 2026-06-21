# Subtask creation materializes projected parents

Subtask creation requires a real parent Task identity. When a User adds a Subtask from a Projected Template Task, Church Task first materializes that projected parent into a real Task, switches the details pane to the real Task Identifier, and then creates real Subtasks under that parent. We choose this over hiding Subtask creation on projected work or creating projected child work, because the user is explicitly treating the projected parent as actionable work.
