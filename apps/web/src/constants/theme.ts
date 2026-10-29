import { Theme } from "@/lib/theme-preference";

export interface I_THEME_OPTION {
  key: string;
  value: Theme;
  label: string;
  type: "light" | "dark";
  icon: {
    color1: string;
    color2: string;
    border: string;
  };
}

export const THEME_OPTIONS: I_THEME_OPTION[] = [
  {
    key: "system",
    value: "system",
    label: "System preference",
    type: "light",
    icon: {
      border: "#DEE2E6",
      color1: "#FAFAFA",
      color2: "#3E77FD",
    },
  },
  {
    key: "light",
    value: "light",
    label: "Light",
    type: "light",
    icon: {
      border: "#DEE2E6",
      color1: "#FAFAFA",
      color2: "#3E77FD",
    },
  },
  {
    key: "dark",
    value: "dark",
    label: "Dark",
    type: "dark",
    icon: {
      border: "#2E3234",
      color1: "#191B1B",
      color2: "#3E77FD",
    },
  },
  // {
  //   key: "light_contrast",
  //   value: "light-contrast",
  //   i18n_label: "Light high contrast",
  //   type: "light",
  //   icon: {
  //     border: "#000000",
  //     color1: "#FFFFFF",
  //     color2: "#3E77FD",
  //   },
  // },
  // {
  //   key: "dark_contrast",
  //   value: "dark-contrast",
  //   i18n_label: "Dark high contrast",
  //   type: "dark",
  //   icon: {
  //     border: "#FFFFFF",
  //     color1: "#030303",
  //     color2: "#3A8BE9",
  //   },
  // },
  // {
  //   key: "custom",
  //   value: "custom",
  //   i18n_label: "Custom theme",
  //   type: "light",
  //   icon: {
  //     border: "#FFC9C9",
  //     color1: "#FFF7F7",
  //     color2: "#FF5151",
  //   },
  // },
];
