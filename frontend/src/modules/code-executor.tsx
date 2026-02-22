import type { ModuleManifest } from "../types/module";
import type { NodeRendererProps } from "../lib/nodeRenderers";

function CodeRenderer({ node, onExecute, onRefresh }: NodeRendererProps) {
  const input = (node.metadata?.input as Record<string, string>) ?? {};
  const output = (node.metadata?.output as Record<string, string>) ?? {};
  const status = node.metadata?.status;
  const code = input.code ?? "";
  const language = input.language ?? "python";
  const stdout = output.stdout ?? "";
  const stderr = output.stderr ?? "";

  return (
    <div className="text-xs space-y-2">
      {/* Code input */}
      <div className="bg-neutral-950 rounded p-2 font-mono text-[11px] text-blue-300 whitespace-pre-wrap max-h-[200px] overflow-auto">
        <span className="text-neutral-600 text-[9px] block mb-1">{language}</span>
        {code || <span className="text-neutral-600 italic">No code</span>}
      </div>

      {/* Output */}
      {status === "complete" && (stdout || stderr) && (
        <div className="bg-neutral-950 rounded p-2 font-mono text-[11px] whitespace-pre-wrap max-h-[200px] overflow-auto">
          {stdout && (
            <div className="text-green-300">{stdout}</div>
          )}
          {stderr && (
            <div className="text-red-400">{stderr}</div>
          )}
        </div>
      )}

      {/* Error display */}
      {status === "error" && node.metadata?.error && (
        <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1">
          {node.metadata.error}
        </div>
      )}

      {/* Action buttons */}
      {status !== "executing" && (
        <div className="flex gap-1.5">
          <button
            onClick={() =>
              status === "complete"
                ? onRefresh?.(node.id)
                : onExecute?.(node.id)
            }
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors"
          >
            {status === "complete" ? "Re-run" : "Run"}
          </button>
        </div>
      )}

      {status === "executing" && (
        <div className="flex items-center gap-1.5 text-yellow-400 text-[10px]">
          <span className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          Executing...
        </div>
      )}
    </div>
  );
}

const manifest: ModuleManifest = {
  id: "code-executor",
  name: "Code Executor",
  version: "0.1.0",
  backendModule: "code_executor",
  nodeRenderers: {
    code: CodeRenderer,
  },
};

export default manifest;
