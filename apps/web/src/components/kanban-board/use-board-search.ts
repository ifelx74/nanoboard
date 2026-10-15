import { useState } from "react";

/**
 * Board title search: session memory only, reset on project switch.
 * Filters persist per project; search never does.
 */
export function useBoardSearch(projectId: string) {
  const [project, setProject] = useState(projectId);
  const [search, setSearch] = useState("");

  // Same remount-safe pattern as the label filter: a project switch without
  // remount resets instead of leaking the previous query.
  if (project !== projectId) {
    setProject(projectId);
    setSearch("");
  }

  return { search, setSearch };
}
