export type {
  WorkflowDefinitionScope,
  WorkflowNodeType,
  WorkflowDefinitionNodePosition,
  WorkflowDefinitionNode,
  WorkflowDefinitionEdge,
  WorkflowDefinitionDocument,
  DbWorkflowDefinition,
  CreateWorkflowDefinitionInput,
  UpdateWorkflowDefinitionInput
} from './db/workflow-definition'

import type {
  DbWorkflowDefinition,
  WorkflowDefinitionDocument
} from './db/workflow-definition'

export interface WorkflowDefinition extends Omit<DbWorkflowDefinition, 'definition_json'> {
  definition: WorkflowDefinitionDocument
}
