import type { ComponentType } from "react";
import React from "react";

const TanStackRouterDevtools: ComponentType = import.meta.env.PROD
  ? () => null
  : React.lazy(() =>
      import("@tanstack/react-router-devtools").then((res) => ({
        default: () => <res.TanStackRouterDevtools position="bottom-right" />,
      })),
    );

export default TanStackRouterDevtools;
