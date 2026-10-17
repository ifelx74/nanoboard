/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { PreferencesSettings } from "./preferences/preferences-settings";

// local imports

type Props = {
  className?: string;
};

export const SettingsContent = (props: Props) => {
  const { className } = props;

  return (
    <div className={cn("flex shrink-0 flex-col overflow-hidden", className)}>
      <ScrollArea>
        <div className="px-8 py-9">
          <PreferencesSettings />
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
};
