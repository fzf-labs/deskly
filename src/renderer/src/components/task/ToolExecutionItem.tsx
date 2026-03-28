export { ToolExecutionItem } from '@features/task-detail'

    case 'Task':
      return {
        hasContent: true,
        summary: 'Subtask completed',
        isWarning: false,
      };

    default:
      return {
        hasContent: lineCount > 0,
        summary: lineCount > 0 ? `${lineCount} lines` : '(No content)',
        isWarning: false,
      };
  }
}

// Tool Detail Modal Component
function ToolDetailModal({
  toolName,
  input,
  output,
  isError,
  isWarning,
  onClose,
}: {
  toolName: string;
  input: Record<string, unknown> | undefined;
  output: string | undefined;
  isError: boolean;
  isWarning: boolean;
  onClose: () => void;
}) {
  const formatInput = (input: unknown): string => {
    if (!input) return 'No input';
    try {
      return JSON.stringify(input, null, 2);
    } catch {
      return String(input);
    }
  };

  const formatOutput = (output: string | undefined): string => {
    if (!output) return 'No output';
    // Extract content from <tool_use_error> tag if present
    const toolUseErrorMatch = output.match(
      /<tool_use_error>([\s\S]*?)<\/tool_use_error>/
    );
    let cleanOutput = toolUseErrorMatch ? toolUseErrorMatch[1].trim() : output;
    // Truncate very long output
    if (cleanOutput.length > 10000) {
      return cleanOutput.slice(0, 10000) + '\n\n... (truncated)';
    }
    return cleanOutput;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="bg-background border-border relative flex max-h-[80vh] w-[700px] max-w-[90vw] flex-col rounded-lg border shadow-xl">
        {/* Header */}
        <div className="border-border flex shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium">{toolName}</span>
            {isError && (
              <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-500">
                Error
              </span>
            )}
            {isWarning && !isError && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-500">
                Info
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="hover:bg-accent cursor-pointer rounded-md p-1 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-auto p-4">
          {/* Input Section */}
          <div>
            <h3 className="text-muted-foreground mb-2 text-sm font-medium">
              Input
            </h3>
            <pre className="bg-muted/50 max-h-[200px] overflow-auto rounded-md p-3 font-mono text-xs break-words whitespace-pre-wrap">
              {formatInput(input)}
            </pre>
          </div>

          {/* Output Section */}
          <div>
            <h3 className="text-muted-foreground mb-2 text-sm font-medium">
              Output
            </h3>
            <pre
              className={cn(
                'max-h-[400px] overflow-auto rounded-md p-3 font-mono text-xs break-words whitespace-pre-wrap',
                isError
                  ? 'bg-red-500/10 text-red-400'
                  : isWarning
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'bg-muted/50'
              )}
            >
              {formatOutput(output)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolExecutionItem({
  message,
  result,
  isLast,
}: ToolExecutionItemProps) {
  const [showModal, setShowModal] = useState(false);

  const toolName = message.name || 'Tool';
  const input = message.input as Record<string, unknown> | undefined;
  const displayName = getToolDisplayName(toolName);
  const fullParam = getFullParamString(toolName, input);
  const truncatedParam = getTruncatedParam(fullParam);
  const { summary, isWarning } = getResultInfo(toolName, result);

  // Check status
  const isRunning = isLast && !result;
  const hasError =
    result?.isError ||
    (result?.output || result?.content || '').toLowerCase().includes('error');
  // If it's a warning (expected non-fatal), don't treat as error
  const isActualError = hasError && !isWarning;
  const isCompleted = !isRunning && !isActualError && result;

  const handleClick = () => {
    if (!isRunning) {
      setShowModal(true);
    }
  };

  return (
    <>
      <div
        className={cn(
          '-mx-1 rounded-md px-1 py-1.5 font-mono text-[13px] transition-colors',
          !isRunning && 'hover:bg-accent/50 cursor-pointer'
        )}
        onClick={handleClick}
      >
        {/* Line 1: bullet + tool name + params */}
        <div className="flex items-start gap-2">
          {/* Bullet indicator */}
          <span
            className={cn(
              'mt-1.5 size-2 shrink-0 rounded-full',
              isRunning
                ? 'animate-pulse bg-amber-500'
                : isActualError
                  ? 'bg-red-500'
                  : isWarning
                    ? 'bg-amber-500'
                    : isCompleted
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground'
            )}
          />

          {/* Tool call text */}
          <div className="min-w-0 flex-1">
            <p className="leading-relaxed">
              <span className="text-foreground font-semibold">
                {displayName}
              </span>
              {fullParam && (
                <>
                  <span className="text-muted-foreground">(</span>
                  <span className="text-muted-foreground">
                    {truncatedParam}
                  </span>
                  <span className="text-muted-foreground">)</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Line 2: Result summary */}
        <div className="mt-0.5 ml-1 flex items-start gap-2">
          <span className="text-muted-foreground/40 leading-none">└</span>
          <span
            className={cn(
              isActualError
                ? 'text-red-500'
                : isWarning
                  ? 'text-amber-500'
                  : 'text-muted-foreground'
            )}
          >
            {summary}
          </span>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <ToolDetailModal
          toolName={toolName}
          input={input}
          output={result?.output || result?.content}
          isError={isActualError}
          isWarning={isWarning}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
