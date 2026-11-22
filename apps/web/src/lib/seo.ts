import { i18n } from "@/lib/i18n";

const MAX_PROJECT_NAME_LENGTH = 34;
const MAX_PAGE_TITLE_LENGTH = 50;

export function displayProjectName(
  name: string | undefined,
): string | undefined {
  if (name === undefined) return undefined;
  const trimmed = name.trim();
  if (trimmed.length <= MAX_PROJECT_NAME_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_PROJECT_NAME_LENGTH - 1)}…`;
}

function displayPageTitle(title: string | undefined): string | undefined {
  if (title === undefined) return undefined;
  const trimmed = title.trim();
  if (trimmed.length === 0) return undefined;
  if (trimmed.length <= MAX_PAGE_TITLE_LENGTH) return trimmed;
  return `${trimmed.slice(0, MAX_PAGE_TITLE_LENGTH - 1)}…`;
}

export function pageMeta(title: string, description: string) {
  return {
    meta: [{ title }, { name: "description", content: description }],
  };
}

export type ProjectSection =
  | "board"
  | "list"
  | "calendar"
  | "pages"
  | "archives"
  | "whiteboard"
  | "timeline";

export function projectPageMeta(
  section: ProjectSection,
  projectName: string | undefined,
) {
  const project = displayProjectName(projectName);
  if (project === undefined) {
    const title = i18n.t("seo:fallbackTitle");
    const description = i18n.t("seo:defaultDescription");
    return pageMeta(title, description);
  }
  switch (section) {
    case "board": {
      const title = i18n.t("seo:boardTitle", { project });
      const description = i18n.t("seo:boardDescription", { project });
      return pageMeta(title, description);
    }
    case "list": {
      const title = i18n.t("seo:listTitle", { project });
      const description = i18n.t("seo:listDescription", { project });
      return pageMeta(title, description);
    }
    case "calendar": {
      const title = i18n.t("seo:calendarTitle", { project });
      const description = i18n.t("seo:calendarDescription", { project });
      return pageMeta(title, description);
    }
    case "timeline": {
      const title = i18n.t("seo:timelineTitle", { project });
      const description = i18n.t("seo:timelineDescription", { project });
      return pageMeta(title, description);
    }
    case "pages": {
      const title = i18n.t("seo:pagesTitle", { project });
      const description = i18n.t("seo:pagesDescription", { project });
      return pageMeta(title, description);
    }
    case "archives": {
      const title = i18n.t("seo:archivesTitle", { project });
      const description = i18n.t("seo:archivesDescription", { project });
      return pageMeta(title, description);
    }
    case "whiteboard": {
      const title = i18n.t("seo:projectWhiteboardTitle", { project });
      const description = i18n.t("seo:projectWhiteboardDescription", {
        project,
      });
      return pageMeta(title, description);
    }
  }
}

export function projectPageDetailMeta(
  projectName: string | undefined,
  pageTitle: string | undefined,
) {
  const project = displayProjectName(projectName);
  if (project === undefined) {
    const title = i18n.t("seo:fallbackTitle");
    const description = i18n.t("seo:defaultDescription");
    return pageMeta(title, description);
  }
  const page = displayPageTitle(pageTitle);
  if (page === undefined) {
    return projectPageMeta("pages", projectName);
  }
  const title = i18n.t("seo:pageDetailTitle", { page, project });
  const description = i18n.t("seo:pagesDescription", { project });
  return pageMeta(title, description);
}

export function projectRouteHead(section: ProjectSection) {
  return ({ loaderData }: { loaderData?: { name?: string } }) =>
    projectPageMeta(section, loaderData?.name);
}

export function projectPageDetailRouteHead() {
  return ({
    loaderData,
  }: {
    loaderData?: { project?: { name?: string }; page?: { title?: string } };
  }) => projectPageDetailMeta(loaderData?.project?.name, loaderData?.page?.title);
}
