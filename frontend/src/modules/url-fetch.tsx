import type { ModuleManifest } from "../types/module";
import type { NodeRendererProps } from "../lib/nodeRenderers";

function FetchRenderer({ node, onExecute, onRefresh }: NodeRendererProps) {
  const input = (node.metadata?.input as Record<string, string>) ?? {};
  const output = (node.metadata?.output as Record<string, unknown>) ?? {};
  const status = node.metadata?.status;
  const url = input.url ?? "";
  const statusCode = output.statusCode as number | undefined;
  const body = (output.body as string) ?? "";

  return (
    <div className="text-xs space-y-2">
      {/* URL input */}
      <div className="flex items-center gap-1.5 bg-neutral-950 rounded px-2 py-1.5 font-mono text-[11px]">
        <span className="text-neutral-500">GET</span>
        <span className="text-cyan-300 truncate">{url || "(no URL)"}</span>
      </div>

      {/* Response */}
      {status === "complete" && (
        <>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span
              className={`px-1.5 py-0.5 rounded font-medium ${
                statusCode && statusCode < 300
                  ? "bg-green-500/20 text-green-400"
                  : statusCode && statusCode < 400
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
              }`}
            >
              {statusCode}
            </span>
            <span className="text-neutral-500">
              {(output.contentType as string) ?? ""}
            </span>
          </div>
          {body && (
            <div className="bg-neutral-950 rounded p-2 font-mono text-[10px] text-neutral-400 whitespace-pre-wrap max-h-[200px] overflow-auto">
              {body.slice(0, 1500)}
              {body.length > 1500 && (
                <span className="text-neutral-600">
                  {"\n"}... ({body.length} chars total)
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Error */}
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
            className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
          >
            {status === "complete" ? "Re-fetch" : "Fetch"}
          </button>
        </div>
      )}

      {status === "executing" && (
        <div className="flex items-center gap-1.5 text-yellow-400 text-[10px]">
          <span className="w-3 h-3 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          Fetching...
        </div>
      )}
    </div>
  );
}

const manifest: ModuleManifest = {
  id: "url-fetch",
  name: "URL Fetch",
  version: "0.1.0",
  backendModule: "url_fetch",
  nodeRenderers: {
    fetch: FetchRenderer,
  },
};

export default manifest;
