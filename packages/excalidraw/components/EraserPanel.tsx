import React from "react";
import { t } from "../i18n";
import { Section } from "./Section";
import { Island } from "./Island";
import { CLASSES } from "@excalidraw/common";
import { isEraserActive } from "../appState";
import { ActionManager } from "../actions/manager";
import type { AppClassProperties, UIAppState } from "../types";

import "./EraserPanel.scss";

interface EraserPanelProps {
  appState: UIAppState;
  app: AppClassProperties;
  actionManager: ActionManager;
}

export const EraserPanel = ({
  appState,
  actionManager,
  app,
}: EraserPanelProps) => {
  const isToolEraser = isEraserActive(appState);

  // Debugging to verify eraser state in the console
  console.log("Eraser active:", isToolEraser);
  console.log("Pixel eraser enabled:", appState.pixelEraserEnabled);

  if (!isToolEraser) {
    return null;
  }

  return (
    <Section
      heading="selectedShapeActions"
      className="eraser-panel zen-mode-transition"
    >
      <Island 
        className={`${CLASSES.SHAPE_ACTIONS_MENU} eraser-panel-container`}
        padding={2}
      >
        <div className="panelColumn">
          <fieldset>
            <legend>{t("labels.eraserSettings")}</legend>
            {actionManager.renderAction("changeEraserSize")}
            {actionManager.renderAction("togglePixelEraser")}
          </fieldset>
        </div>
      </Island>
    </Section>
  );
};