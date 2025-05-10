import React, { useState, useEffect } from "react";
import { t } from "../i18n";
import { Range } from "./Range";
import { useDevice } from "./App";
import { ShapesSwitcher } from "./Actions";
import "./EraserSettings.scss";

export const EraserSettings = ({
  value,
  onChange,
  pixelEraserEnabled,
  onTogglePixelEraser,
}: {
  value: number;
  onChange: (value: number) => void;
  pixelEraserEnabled: boolean;
  onTogglePixelEraser: (enabled: boolean) => void;
}) => {
  const device = useDevice();

  // Create preview canvas to show eraser size
  const [previewCanvasRef, setPreviewCanvasRef] = useState<HTMLCanvasElement | null>(null);

  // Update preview canvas when size changes
  useEffect(() => {
    if (previewCanvasRef) {
      updatePreviewCanvas(previewCanvasRef, value);
    }
  }, [value, previewCanvasRef]);

  // Function to update the preview canvas
  const updatePreviewCanvas = (canvas: HTMLCanvasElement, size: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const canvasSize = 80; // Fixed canvas size
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    // Draw example stroke
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(15, canvasSize/2);
    ctx.lineTo(canvasSize - 15, canvasSize/2);
    ctx.stroke();

    // Draw eraser circle
    const centerX = canvasSize / 2;
    const centerY = canvasSize / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, size, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ff0000';
    ctx.stroke();
  };

  return (
    <div className="eraser-settings">
      {/* Eraser Mode Switcher */}
      <div className="eraser-mode-switcher">
        <div className="eraser-settings__title">{t("labels.eraserMode")}</div>
        <div className="eraser-mode-buttons">
          <button
            className={`eraser-mode-button ${!pixelEraserEnabled ? 'active' : ''}`}
            onClick={() => onTogglePixelEraser(false)}
          >
            {t("labels.strokeEraser")}
          </button>
          <button
            className={`eraser-mode-button ${pixelEraserEnabled ? 'active' : ''}`}
            onClick={() => onTogglePixelEraser(true)}
          >
            {t("labels.pixelEraser")}
          </button>
        </div>
        <div className="help-text">
          {pixelEraserEnabled
            ? t("labels.pixelEraserHint")
            : t("labels.strokeEraserHint")}
        </div>
      </div>

      {/* Eraser Size Control */}
      <div className="eraser-size-control">
        <div className="eraser-settings__title">{t("labels.eraserSize")}</div>
        <div className="eraser-size-preview-container">
          <canvas
            ref={setPreviewCanvasRef}
            className="eraser-size-preview-canvas"
            width="80"
            height="80"
          />
        </div>
        <div className="eraser-size-range">
          <input
            type="range"
            min="1"
            max="50"
            step="1"
            value={value}
            onChange={(event) => {
              onChange(+event.target.value);
            }}
            className="range-input"
            data-testid="eraser-size"
          />
          <div className="value">{value}px</div>
        </div>
      </div>
    </div>
  );
};