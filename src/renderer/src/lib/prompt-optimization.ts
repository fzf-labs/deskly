type TaskStringsLike = Record<string, string | undefined>

export const resolvePromptOptimizationErrorMessage = (
  error: unknown,
  taskStrings: TaskStringsLike
): string => {
  const message = error instanceof Error ? error.message : String(error ?? '')

  if (message.includes('CLI tool is disabled in Settings -> Agent CLI')) {
    return (
      taskStrings.promptOptimizationCliUnavailable ||
      'No supported AI CLI tool was found. Please install Claude Code or Codex first.'
    )
  }

  if (message.includes('PROMPT_OPTIMIZATION_CLI_UNAVAILABLE')) {
    return (
      taskStrings.promptOptimizationCliUnavailable ||
      'No supported AI CLI tool was found. Please install Claude Code or Codex first.'
    )
  }

  if (message.includes('PROMPT_OPTIMIZATION_RUNTIME_UNAVAILABLE')) {
    return (
      taskStrings.promptOptimizationRuntimeUnavailable ||
      'Prompt optimization is temporarily unavailable. Please try again.'
    )
  }

  if (message.includes('PROMPT_OPTIMIZATION_NO_OUTPUT')) {
    return (
      taskStrings.promptOptimizationNoOutput ||
      'The AI tool did not return a parsable optimization result.'
    )
  }

  if (message.includes('PROMPT_OPTIMIZATION_EMPTY_RESULT')) {
    return (
      taskStrings.promptOptimizationEmptyResult ||
      'The AI tool did not return a usable optimized prompt.'
    )
  }

  if (
    message.includes('PROMPT_OPTIMIZATION_PARSE_FAILED') ||
    message.includes('CLI_ONE_SHOT_TIMEOUT')
  ) {
    return (
      taskStrings.promptOptimizationParseFailed ||
      'The AI response could not be parsed as an optimized prompt.'
    )
  }

  if (message.includes('PROMPT_OPTIMIZATION_FAILED')) {
    return (
      taskStrings.promptOptimizationFailed || 'Prompt optimization failed. Please try again.'
    )
  }

  return message || taskStrings.promptOptimizationFailed || 'Prompt optimization failed.'
}
