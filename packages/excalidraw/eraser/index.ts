import { arrayToMap, easeOut, THEME } from "@excalidraw/common";
import { getElementLineSegments } from "@excalidraw/element/bounds";
import {
  lineSegment,
  lineSegmentIntersectionPoints,
  pointFrom,
} from "@excalidraw/math";

import { getElementsInGroup } from "@excalidraw/element/groups";

import { getElementShape } from "@excalidraw/element/shapes";
import { shouldTestInside } from "@excalidraw/element/collision";
import { isPointInShape } from "@excalidraw/utils/collision";
import {
  hasBoundTextElement,
  isBoundToContainer,
} from "@excalidraw/element/typeChecks";
import { getBoundTextElementId } from "@excalidraw/element/textElement";

import type { GeometricShape } from "@excalidraw/utils/shape";
import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
} from "@excalidraw/math/types";
import type { ElementsMap, ExcalidrawElement } from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";

import type { AnimationFrameHandler } from "../animation-frame-handler";

// Use type-only import to avoid circular dependencies
import type App from "../components/App";

// just enough to form a segment; this is sufficient for eraser
const POINTS_ON_TRAIL = 2;

export class EraserTrail extends AnimatedTrail {
  private elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private groupsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private segmentsCache: Map<string, LineSegment<GlobalPoint>[]> = new Map();
  private geometricShapesCache: Map<string, GeometricShape<GlobalPoint>> =
    new Map();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      streamline: 0.2,
      // Use the current eraser size from app state with a fallback to 5
      get size() {
        // Use the current eraser size from app state
        return app.state.currentEraserSize || 5;
      },
      keepHead: true,
      sizeMapping: (c) => {
        const DECAY_TIME = 200;
        const DECAY_LENGTH = 10;
        const t = Math.max(
          0,
          1 - (performance.now() - c.pressure) / DECAY_TIME,
        );
        const l =
          (DECAY_LENGTH -
            Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
          DECAY_LENGTH;

        return Math.min(easeOut(l), easeOut(t));
      },
      fill: () =>
        app.state.theme === THEME.LIGHT
          ? "rgba(0, 0, 0, 0.2)"
          : "rgba(255, 255, 255, 0.2)",
    });
  }

  /**
   * Updates the eraser size to match the current app state
   * This is called before each new eraser path is started
   */
  updateSize(size?: number) {
    // Allow explicit size update via parameter
    if (size !== undefined) {
      // We can modify the app state directly to update the size
      this.app.setState({ currentEraserSize: size });
    }

    // We don't need to do anything else as the size will be read from app state
    // when needed through the getter in the constructor options
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.elementsToErase.clear();
  }

  addPointToPath(x: number, y: number, restore = false) {
    super.addPointToPath(x, y);

    const elementsToEraser = this.updateElementsToBeErased(restore);

    return elementsToEraser;
  }

  private updateElementsToBeErased(restoreToErase?: boolean) {
    // Log the current eraser mode and size for debugging
    console.log("Eraser mode - Pixel enabled:", this.app.state.pixelEraserEnabled);
    console.log("Eraser size:", this.app.state.currentEraserSize);

    // If we're using pixel eraser, we need to use the pixel eraser trail
    // But we'll still detect elements with the regular eraser for consistency
    if (this.app.state.pixelEraserEnabled && (this.app as any).pixelEraserTrail) {
      // Add the current point to the pixel eraser trail
      const trail = super.getCurrentTrail();
      if (trail && trail.originalPoints && trail.originalPoints.length > 0) {
        const lastPoint = trail.originalPoints[trail.originalPoints.length - 1];
        (this.app as any).pixelEraserTrail.addPointToPath(lastPoint[0], lastPoint[1]);
      }
    }

    let eraserPath: GlobalPoint[] =
      super
        .getCurrentTrail()
        ?.originalPoints?.map((p) => pointFrom<GlobalPoint>(p[0], p[1])) || [];

    // for efficiency and avoid unnecessary calculations,
    // take only POINTS_ON_TRAIL points to form some number of segments
    eraserPath = eraserPath?.slice(eraserPath.length - POINTS_ON_TRAIL);

    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked,
    );

    const candidateElementsMap = arrayToMap(candidateElements);

    const pathSegments = eraserPath.reduce((acc, point, index) => {
      if (index === 0) {
        return acc;
      }
      acc.push(lineSegment(eraserPath[index - 1], point));
      return acc;
    }, [] as LineSegment<GlobalPoint>[]);

    if (pathSegments.length === 0) {
      return [];
    }

    for (const element of candidateElements) {
      // restore only if already added to the to-be-erased set
      if (restoreToErase && this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegments,
          element,
          this.segmentsCache,
          this.geometricShapesCache,
          candidateElementsMap,
          this.app,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );
            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.delete(elementInGroup.id);
            }
            this.groupsToErase.delete(shallowestGroupId);
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.delete(element.containerId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.delete(boundText);
            }
          }

          this.elementsToErase.delete(element.id);
        }
      } else if (!restoreToErase && !this.elementsToErase.has(element.id)) {
        const intersects = eraserTest(
          pathSegments,
          element,
          this.segmentsCache,
          this.geometricShapesCache,
          candidateElementsMap,
          this.app,
        );

        if (intersects) {
          const shallowestGroupId = element.groupIds.at(-1)!;

          if (!this.groupsToErase.has(shallowestGroupId)) {
            const elementsInGroup = getElementsInGroup(
              this.app.scene.getNonDeletedElementsMap(),
              shallowestGroupId,
            );

            for (const elementInGroup of elementsInGroup) {
              this.elementsToErase.add(elementInGroup.id);
            }
            this.groupsToErase.add(shallowestGroupId);
          }

          if (hasBoundTextElement(element)) {
            const boundText = getBoundTextElementId(element);

            if (boundText) {
              this.elementsToErase.add(boundText);
            }
          }

          if (isBoundToContainer(element)) {
            this.elementsToErase.add(element.containerId);
          }

          this.elementsToErase.add(element.id);
        }
      }
    }

    return Array.from(this.elementsToErase);
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.elementsToErase.clear();
    this.groupsToErase.clear();
    this.segmentsCache.clear();
  }
}

/**
 * Test if the eraser path intersects with the element, using the appropriate method
 * based on the pixelEraserEnabled setting.
 */
const eraserTest = (
  pathSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  shapesCache: Map<string, GeometricShape<GlobalPoint>>,
  elementsMap: ElementsMap,
  app: App,
): boolean => {
  // Ensure we read the latest state directly
  const pixelEraserEnabled = app.state.pixelEraserEnabled;

  // Log for debugging
  console.log(`Eraser test for element ${element.id}:`,
    { pixelMode: pixelEraserEnabled, size: app.state.currentEraserSize }
  );

  // For pixel eraser, we want to detect elements using the traditional method
  // but we'll handle the actual erasing differently in App.tsx
  return fullStrokeEraserTest(
    pathSegments,
    element,
    elementsSegments,
    shapesCache,
    elementsMap,
    app
  );
};

/**
 * Test for pixel-based erasing, which checks if the eraser's circular area
 * intersects with any part of the element
 */
const pixelEraserTest = (
  pathSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  shapesCache: Map<string, GeometricShape<GlobalPoint>>,
  elementsMap: ElementsMap,
  app: App,
): boolean => {
  // Log entry point to the pixel eraser test
  console.log(`Pixel eraser test for element:`, element.id);

  let shape = shapesCache.get(element.id);

  if (!shape) {
    shape = getElementShape<GlobalPoint>(element, elementsMap);
    shapesCache.set(element.id, shape);
  }

  const lastPoint = pathSegments[pathSegments.length - 1][1];
  // Increase the minimum eraser size to make it more noticeable for testing
  const eraserSize = Math.max(10, app.state.currentEraserSize || 10);

  // Check if the eraser's circular area intersects with the element
  // by checking if any point is within the eraser's radius
  if (shouldTestInside(element) && isPointInShape(lastPoint, shape)) {
    return true;
  }

  let elementSegments = elementsSegments.get(element.id);

  if (!elementSegments) {
    elementSegments = getElementLineSegments(element, elementsMap);
    elementsSegments.set(element.id, elementSegments);
  }

  // Calculate distance from eraser center to element segments
  // If distance is less than the eraser radius, it's an intersection
  return elementSegments?.some((elementSegment) => {
    const [p1, p2] = elementSegment;

    // Check if either endpoint is within the eraser circle
    const distToP1 = Math.hypot(lastPoint[0] - p1[0], lastPoint[1] - p1[1]);
    const distToP2 = Math.hypot(lastPoint[0] - p2[0], lastPoint[1] - p2[1]);

    if (distToP1 <= eraserSize || distToP2 <= eraserSize) {
      return true;
    }

    // Check if any part of the line segment is within the eraser circle
    // Calculate closest point on the line segment to the eraser center
    const lineLengthSquared = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);

    if (lineLengthSquared === 0) {
      return distToP1 <= eraserSize;
    }

    // Calculate projection of eraser center onto the line segment
    const t = Math.max(0, Math.min(1, (
      (lastPoint[0] - p1[0]) * (p2[0] - p1[0]) +
      (lastPoint[1] - p1[1]) * (p2[1] - p1[1])
    ) / lineLengthSquared));

    const projectionX = p1[0] + t * (p2[0] - p1[0]);
    const projectionY = p1[1] + t * (p2[1] - p1[1]);

    // Calculate distance from eraser center to the closest point on the line
    const distToLine = Math.hypot(lastPoint[0] - projectionX, lastPoint[1] - projectionY);

    return distToLine <= eraserSize;
  }) || false;
};

/**
 * Traditional stroke eraser test that checks if the eraser path (line)
 * intersects with any part of the element
 */
const fullStrokeEraserTest = (
  pathSegments: LineSegment<GlobalPoint>[],
  element: ExcalidrawElement,
  elementsSegments: ElementsSegmentsMap,
  shapesCache: Map<string, GeometricShape<GlobalPoint>>,
  elementsMap: ElementsMap,
  app: App,
): boolean => {
  let shape = shapesCache.get(element.id);

  if (!shape) {
    shape = getElementShape<GlobalPoint>(element, elementsMap);
    shapesCache.set(element.id, shape);
  }

  const lastPoint = pathSegments[pathSegments.length - 1][1];
  if (shouldTestInside(element) && isPointInShape(lastPoint, shape)) {
    return true;
  }

  let elementSegments = elementsSegments.get(element.id);

  if (!elementSegments) {
    elementSegments = getElementLineSegments(element, elementsMap);
    elementsSegments.set(element.id, elementSegments);
  }

  return pathSegments.some((pathSegment) =>
    elementSegments?.some(
      (elementSegment) =>
        lineSegmentIntersectionPoints(
          pathSegment,
          elementSegment,
          app.getElementHitThreshold(),
        ) !== null,
    ),
  );
};
