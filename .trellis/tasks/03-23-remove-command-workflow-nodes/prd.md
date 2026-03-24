# brainstorm: remove command workflow nodes

## Goal

Remove the dedicated `command` workflow node type from Deskly and standardize workflow execution on agent-only nodes as a clean-break change with no legacy data compatibility layer.

## What I already know

* Workflow definitions, workflow run nodes, scheduler behavior, renderer workflow editor, workflow detail view, and tests all currently branch on `agent` vs `command`.
* `command` nodes are executed directly by the main process scheduler with `spawn(command, { shell: true })`.
* `agent` nodes are executed through CLI session startup and require an agent CLI tool selection or config.
* Existing persisted workflow definitions and run-node records may already contain `type: "command"` / `node_type: "command"`, but this task will not support them.

## Assumptions (temporary)

* The desired end state is agent-only authoring and execution semantics for workflows.
* Existing stored workflow data that still uses `command` nodes can be considered invalid after this change.

## Open Questions

* None blocking for implementation; proceed with compatibility-first normalization.

## Requirements (evolving)

* Remove `command` from workflow definition and workflow run node public types.
* Remove command-node-specific scheduler execution and route all workflow nodes through agent execution.
* Remove command-node-specific editor and task-detail UI branches.
* Reject or invalidate old command-node data rather than normalizing it.
* Update tests to cover the new agent-only model and compatibility behavior.

## Acceptance Criteria (evolving)

* [ ] New workflow definitions can only contain agent nodes.
* [ ] Workflow scheduler no longer has a dedicated command-node execution path.
* [ ] Renderer workflow editor no longer exposes a command node option.
* [ ] Old command-node data is no longer part of the supported contract.
* [ ] Targeted tests pass after the refactor.

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Reworking generic CLI tool execution outside workflow nodes
* Redesigning unrelated pipeline or automation stage models

## Technical Notes

* Key files inspected:
  * `src/main/services/WorkflowSchedulerService.ts`
  * `src/main/services/WorkflowRunService.ts`
  * `src/main/services/WorkflowDefinitionService.ts`
  * `src/main/services/WorkflowDefinitionGenerationService.ts`
  * `src/main/services/database/DatabaseConnection.ts`
  * `src/main/services/database/WorkflowDefinitionRepository.ts`
  * `src/main/services/database/WorkflowRunNodeRepository.ts`
  * `src/renderer/src/components/pipeline/WorkflowTemplateDialog.tsx`
  * `src/renderer/src/components/pipeline/workflow-definition-form.ts`
  * `src/renderer/src/pages/task-detail/useTaskDetail.tsx`
  * `src/renderer/src/pages/task-detail/workflow-graph.ts`
  * `src/renderer/src/pages/task-detail/components/WorkflowCard.tsx`
* Intentional breaking change:
  * SQLite schema, JSON definitions, and tests should be updated to agent-only contracts without adding a legacy normalization path.
