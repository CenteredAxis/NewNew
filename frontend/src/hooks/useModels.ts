import { useState, useEffect, useCallback } from "react";
import { fetchModels, type ApiConfig } from "../lib/api";

export function useModels(config: ApiConfig) {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchModels(config);
      setModels(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load models");
    } finally {
      setLoading(false);
    }
  // config object identity changes on each render, depend on primitives
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.endpointUrl, config.apiKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { models, loading, error, refresh };
}
