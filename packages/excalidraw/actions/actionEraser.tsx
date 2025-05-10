import { t } from "../i18n";
import type { AppState } from "../types";
import { register } from "./register";
import { CaptureUpdateAction } from "../store";
import React from "react";
import { getFormValue } from "./actionProperties";
import { EraserSettings } from "../components/EraserSettings";

export const actionChangeEraserSize = register({
  name: "changeEraserSize",
  label: "labels.eraserSize",
  trackEvent: false,
  perform: (elements, appState, value) => {
    return {
      appState: { ...appState, currentEraserSize: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const value = getFormValue(
      elements,
      appState,
      () => appState.currentEraserSize,
      true,
      appState.currentEraserSize,
    );

    return (
      <fieldset>
        <legend>{t("labels.eraserSize")}</legend>
        <div className="eraser-size-range">
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={value}
            onChange={(event) => {
              updateData(+event.target.value);
            }}
            className="range-input"
            data-testid="eraser-size"
          />
          <div className="value">{value}px</div>
        </div>
      </fieldset>
    );
  },
});

export const actionTogglePixelEraser = register({
  name: "togglePixelEraser",
  label: "labels.eraserMode",
  trackEvent: false,
  perform: (elements, appState, value) => {
    console.log("Toggling pixel eraser to:", value);
    // Force update to ensure the pixel eraser state change takes effect
    return {
      appState: { ...appState, pixelEraserEnabled: value },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    return (
      <fieldset>
        <legend>{t("labels.eraserMode")}</legend>
        <div className="eraser-mode-toggle">
          <label htmlFor="pixel-eraser-toggle">
            <input
              type="checkbox"
              id="pixel-eraser-toggle"
              checked={appState.pixelEraserEnabled}
              onChange={(event) => {
                console.log("Toggle pixel eraser checkbox changed to:", event.target.checked);
                updateData(event.target.checked);
              }}
            />
            {t("labels.pixelEraser")}
          </label>
          <div className="help-text">
            {appState.pixelEraserEnabled
              ? t("labels.pixelEraserHint")
              : t("labels.strokeEraserHint")}
          </div>
        </div>
      </fieldset>
    );
  },
});

export const actionEraserSettings = register({
  name: "eraserSettings",
  label: "labels.eraserSettings",
  trackEvent: false,
  perform: (elements, appState, value) => {
    if (value.type === "size") {
      return {
        appState: { ...appState, currentEraserSize: value.size },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    } else if (value.type === "mode") {
      return {
        appState: { ...appState, pixelEraserEnabled: value.enabled },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }
    return { appState, captureUpdate: CaptureUpdateAction.IMMEDIATELY };
  },
  PanelComponent: ({ elements, appState, updateData }) => {
    const eraserSize = getFormValue(
      elements,
      appState,
      () => appState.currentEraserSize,
      true,
      appState.currentEraserSize,
    );

    return (
      <fieldset>
        <legend>{t("labels.eraserSettings")}</legend>
        <EraserSettings
          value={eraserSize}
          onChange={(size) => updateData({ type: "size", size })}
          pixelEraserEnabled={appState.pixelEraserEnabled}
          onTogglePixelEraser={(enabled) => updateData({ type: "mode", enabled })}
        />
      </fieldset>
    );
  },
});