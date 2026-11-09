import { Link, type LucideIcon } from "lucide-react";

import Github from "@/icons/brand/github";
import Bitbucket from "@/icons/brand/bitbucket";
import Discord from "@/icons/brand/discord";
import Dropbox from "@/icons/brand/dropbox";
import Figma from "@/icons/brand/figma";
import Gitlab from "@/icons/brand/gitlab";
import GoogleDocs from "@/icons/brand/google-docs";
import GoogleDrive from "@/icons/brand/google-drive";
import GoogleSheets from "@/icons/brand/google-sheets";
import GoogleSlides from "@/icons/brand/google-slides";
import Jira from "@/icons/brand/jira";
import Linkedin from "@/icons/brand/linkedin";
import Notion from "@/icons/brand/notion";
import Onedrive from "@/icons/brand/onedrive";
import Slack from "@/icons/brand/slack";
import Trello from "@/icons/brand/trello";
import Twitter from "@/icons/brand/twitter";
import Youtube from "@/icons/brand/youtube";
import { linkHost } from "./link-host";
import GoogleMeet from "@/icons/brand/google-meet";

export type ResourceIcon =
  LucideIcon | React.ComponentType<React.SVGProps<SVGSVGElement>>;

const HOST_TO_ICON: Record<string, ResourceIcon> = {
  "github.com": Github,
  "gitlab.com": Gitlab,
  "bitbucket.org": Bitbucket,
  "drive.google.com": GoogleDrive,
  "sheets.google.com": GoogleSheets,
  "slides.google.com": GoogleSlides,
  "meet.google.com": GoogleMeet,
  "figma.com": Figma,
  "notion.so": Notion,
  "youtube.com": Youtube,
  "youtu.be": Youtube,
  "x.com": Twitter,
  "twitter.com": Twitter,
  "atlassian.net": Jira,
  "trello.com": Trello,
  "dropbox.com": Dropbox,
  "slack.com": Slack,
  "discord.com": Discord,
  "linkedin.com": Linkedin,
  "onedrive.com": Onedrive,
  "sharepoint.com": Onedrive,
};

function googleIcon(url: string, host: string): ResourceIcon | undefined {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return undefined;
  }
  if (host === "drive.google.com") return GoogleDrive;
  if (host === "docs.google.com") {
    if (pathname.startsWith("/document")) return GoogleDocs;
    if (pathname.startsWith("/spreadsheets")) return GoogleSheets;
    if (pathname.startsWith("/presentation")) return GoogleSlides;
    if (pathname.startsWith("/forms")) return GoogleSlides;
    return GoogleDocs;
  }
  return undefined;
}

export function getResourceIcon(url: string): ResourceIcon {
  const host = linkHost(url)?.toLowerCase() ?? "";
  if (!host) return Link;

  if (
    host === "docs.google.com" ||
    host === "drive.google.com" ||
    host === "sheets.google.com" ||
    host === "slides.google.com"
  ) {
    return googleIcon(url, host) ?? HOST_TO_ICON[host] ?? Link;
  }

  return (
    HOST_TO_ICON[host] ??
    Object.entries(HOST_TO_ICON).find(([domain]) => {
      if (domain.includes(".google.com") || domain === "atlassian.net") {
        return false;
      }
      return host.endsWith(`.${domain}`);
    })?.[1] ??
    (host.endsWith(".atlassian.net") ? Jira : undefined) ??
    Link
  );
}
