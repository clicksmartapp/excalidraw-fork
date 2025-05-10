import {
  lineSegment,
  pointFrom,
} from "@excalidraw/math";

import { getElementsInGroup } from "@excalidraw/element/groups";
import { getElementLineSegments } from "@excalidraw/element/bounds";
import { getElementShape } from "@excalidraw/element/shapes";
import { shouldTestInside } from "@excalidraw/element/collision";
import { isPointInShape } from "@excalidraw/utils/collision";
import {
  hasBoundTextElement,
  isBoundToContainer,
  isLinearElement,
  isTextElement,
  isFreeDrawElement,
} from "@excalidraw/element/typeChecks";
import { getBoundTextElementId } from "@excalidraw/element/textElement";
import { newElementWith } from "@excalidraw/element/mutateElement";

import { arrayToMap } from "@excalidraw/common";

import type { GeometricShape } from "@excalidraw/utils/shape";
import type {
  ElementsSegmentsMap,
  GlobalPoint,
  LineSegment,
} from "@excalidraw/math/types";
import type { 
  ElementsMap, 
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawFreeDrawElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { AnimatedTrail } from "../animated-trail";
import type { AnimationFrameHandler } from "../animation-frame-handler";
// Use type-only import to avoid circular dependencies
import type App from "../components/App";

// This is a completely new implementation of the pixel eraser
// It focuses on erasing just the parts of elements that intersect with the eraser

export class PixelEraserTrail extends AnimatedTrail {
  elementsToErase: Set<ExcalidrawElement["id"]> = new Set();
  private segmentsCache: Map<string, LineSegment<GlobalPoint>[]> = new Map();
  private shapesCache: Map<string, GeometricShape<GlobalPoint>> = new Map();

  constructor(animationFrameHandler: AnimationFrameHandler, app: App) {
    super(animationFrameHandler, app, {
      streamline: 0.2,
      get size() {
        // Use a larger size to make pixel eraser easier to use
        return app.state.currentEraserSize * 1.5 || 10;
      },
      keepHead: true,
      sizeMapping: (c) => 1, // Keep full size for pixel eraser
      fill: () => "rgba(255, 0, 0, 0.4)", // More visible eraser for testing
    });
  }

  /**
   * Updates the eraser trail to use the current size from app state
   * This is called when the eraser size is changed by the user
   */
  updateSize(): void {
    // We don't need to do anything special here since the size is read
    // from app.state.currentEraserSize via the getter in the constructor options.
    // This method exists to match the EraserTrail API.

    // If there's an active trail, create a new one with the updated size
    const trail = super.getCurrentTrail();
    if (trail && trail.originalPoints && trail.originalPoints.length > 0) {
      // Save the current points
      const points = trail.originalPoints.slice();

      // End the current path and clear it
      this.endPath();

      // Start a new path with the first point from the old trail
      this.startPath(points[0][0], points[0][1]);

      // Add the remaining points to the new path
      for (let i = 1; i < points.length; i++) {
        this.addPointToPath(points[i][0], points[i][1]);
      }
    }
  }

  /**
   * Sets the eraser size explicitly
   * This is a convenience method for the handleEraser function
   * @param size The new eraser size
   */
  setSize(size: number): void {
    // Update the app state with the new size
    if (size !== this.app.state.currentEraserSize) {
      this.app.setState({ currentEraserSize: size });
    }

    // Update any existing trail to use the new size
    this.updateSize();
  }

  startPath(x: number, y: number): void {
    this.endPath();
    super.startPath(x, y);
    this.elementsToErase.clear();
  }

  addPointToPath(x: number, y: number): ExcalidrawElement["id"][] {
    super.addPointToPath(x, y);
    return this.updateElementsToErase(x, y);
  }

  private updateElementsToErase(x: number, y: number): ExcalidrawElement["id"][] {
    console.log("Pixel eraser at:", x, y);
    
    // Current eraser position
    const eraserPoint = pointFrom<GlobalPoint>(x, y);
    const eraserSize = this.app.state.currentEraserSize || 10;
    
    // Get all visible, unlocked elements
    const candidateElements = this.app.visibleElements.filter(
      (el) => !el.locked,
    );
    const elementsMap = arrayToMap(candidateElements);

    // Check each element for intersection with the eraser circle
    for (const element of candidateElements) {
      // Skip if already marked for erasure
      if (this.elementsToErase.has(element.id)) {
        continue;
      }

      // Test if the eraser circle intersects with the element
      const intersects = this.testPixelIntersection(
        eraserPoint,
        eraserSize,
        element,
        elementsMap
      );

      if (intersects) {
        console.log("Pixel eraser intersects with element:", element.id);
        
        // Add the element to the erase set
        this.elementsToErase.add(element.id);
        
        // Handle bound text elements
        if (hasBoundTextElement(element)) {
          const boundTextId = getBoundTextElementId(element);
          if (boundTextId) {
            this.elementsToErase.add(boundTextId);
          }
        }
        
        // Handle container elements
        if (isBoundToContainer(element)) {
          this.elementsToErase.add(element.containerId);
        }
      }
    }

    return Array.from(this.elementsToErase);
  }

  private testPixelIntersection(
    point: GlobalPoint,
    radius: number,
    element: ExcalidrawElement,
    elementsMap: ElementsMap
  ): boolean {
    // Get or create the element shape
    let shape = this.shapesCache.get(element.id);
    if (!shape) {
      shape = getElementShape<GlobalPoint>(element, elementsMap);
      this.shapesCache.set(element.id, shape);
    }

    // Check if the point is inside the shape (for filled elements)
    if (shouldTestInside(element) && isPointInShape(point, shape)) {
      return true;
    }

    // Check if the eraser circle intersects with any of the element's segments
    let elementSegments = this.segmentsCache.get(element.id);
    if (!elementSegments) {
      elementSegments = getElementLineSegments(element, elementsMap);
      this.segmentsCache.set(element.id, elementSegments);
    }

    return elementSegments.some((segment) => {
      const [p1, p2] = segment;
      
      // Check if either endpoint is within the eraser circle
      const distToP1 = Math.hypot(point[0] - p1[0], point[1] - p1[1]);
      const distToP2 = Math.hypot(point[0] - p2[0], point[1] - p2[1]);
      
      if (distToP1 <= radius || distToP2 <= radius) {
        return true;
      }
      
      // If line segment is a point, already checked above
      const lineLengthSquared = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2);
      if (lineLengthSquared === 0) {
        return false;
      }
      
      // Calculate shortest distance from point to line segment
      const t = Math.max(0, Math.min(1, (
        (point[0] - p1[0]) * (p2[0] - p1[0]) +
        (point[1] - p1[1]) * (p2[1] - p1[1])
      ) / lineLengthSquared));
      
      const projectionX = p1[0] + t * (p2[0] - p1[0]);
      const projectionY = p1[1] + t * (p2[1] - p1[1]);
      
      const distance = Math.hypot(point[0] - projectionX, point[1] - projectionY);
      
      return distance <= radius;
    });
  }

  endPath(): void {
    super.endPath();
    super.clearTrails();
    this.elementsToErase.clear();
    this.segmentsCache.clear();
    this.shapesCache.clear();
  }

  /**
   * Process elements for pixel-based erasing
   * This function will modify elements that intersect with the eraser
   * instead of deleting them entirely
   */
  processElementsForPixelErasing(): ExcalidrawElement[] {
    console.log("Processing elements for pixel erasing");
    
    // Get all elements that need to be processed
    const elementsToProcess = Array.from(this.elementsToErase);
    if (elementsToProcess.length === 0) {
      return [];
    }

    // Get the current eraser position and size
    const trail = super.getCurrentTrail();
    if (!trail || !trail.originalPoints || trail.originalPoints.length === 0) {
      return [];
    }

    const eraserPoints = trail.originalPoints.map(p => pointFrom<GlobalPoint>(p[0], p[1]));
    const eraserSize = this.app.state.currentEraserSize || 10;
    
    // Get all elements from the scene
    const allElements = this.app.scene.getElementsIncludingDeleted();
    const elementsMap = arrayToMap(allElements);
    
    // Process each element that intersects with the eraser
    const modifiedElements: ExcalidrawElement[] = [];
    
    for (const elementId of elementsToProcess) {
      const element = elementsMap.get(elementId);
      if (!element || element.isDeleted) {
        continue;
      }
      
      // Different element types need different handling
      if (isFreeDrawElement(element)) {
        const modifiedElement = this.eraseFromFreeDrawElement(
          element,
          eraserPoints,
          eraserSize
        );
        if (modifiedElement) {
          modifiedElements.push(modifiedElement);
        }
      } else if (isLinearElement(element)) {
        const modifiedElement = this.eraseFromLinearElement(
          element,
          eraserPoints,
          eraserSize
        );
        if (modifiedElement) {
          modifiedElements.push(modifiedElement);
        }
      } else {
        // For other element types, we'll still use the traditional approach
        // but we'll mark them for future implementation
        console.log("Element type not yet supported for pixel erasing:", element.type);
      }
    }
    
    return modifiedElements;
  }

  /**
   * Erase parts of a freedraw element that intersect with the eraser
   */
  eraseFromFreeDrawElement(
    element: ExcalidrawFreeDrawElement,
    eraserPoints: GlobalPoint[],
    eraserSize: number
  ): ExcalidrawElement | null {
    // For freedraw elements, we need to filter out points that are within
    // the eraser's radius
    if (!element.points || element.points.length < 2) {
      return null;
    }

    console.log(`Erasing from freedraw element ${element.id} with ${element.points.length} points`);
    
    // Create a new array of points, excluding those that are within the eraser radius
    const newPoints = element.points.filter(point => {
      // Convert the point to global coordinates
      const globalX = element.x + point[0];
      const globalY = element.y + point[1];
      
      // Check against all eraser points
      for (const eraserPoint of eraserPoints) {
        // Calculate distance to eraser point
        const distance = Math.hypot(
          globalX - eraserPoint[0],
          globalY - eraserPoint[1]
        );
        
        // If any eraser point is close enough, remove this element point
        if (distance <= eraserSize) {
          return false;
        }
      }
      
      // Keep the point if it's not close to any eraser point
      return true;
    });
    
    console.log(`After erasing: ${newPoints.length} points remain`);
    
    // If we removed all points or too few remain, mark the element as deleted
    if (newPoints.length < 2) {
      console.log(`Deleting freedraw element ${element.id} as too few points remain`);
      return newElementWith(element, { isDeleted: true });
    }
    
    // Otherwise, update the element with the new points
    return newElementWith(element, { points: newPoints });
  }

  /**
   * Erase parts of a linear element that intersect with the eraser
   */
  eraseFromLinearElement(
    element: ExcalidrawLinearElement,
    eraserPoints: GlobalPoint[],
    eraserSize: number
  ): ExcalidrawElement | null {
    // For linear elements, we need to filter out points that are within
    // the eraser's radius
    if (!element.points || element.points.length < 2) {
      return null;
    }

    console.log(`Erasing from linear element ${element.id} with ${element.points.length} points`);
    
    // Create a new array of points, excluding those that are within the eraser radius
    const newPoints = element.points.filter(point => {
      // Convert the point to global coordinates
      const globalX = element.x + point[0];
      const globalY = element.y + point[1];
      
      // Check against all eraser points
      for (const eraserPoint of eraserPoints) {
        // Calculate distance to eraser point
        const distance = Math.hypot(
          globalX - eraserPoint[0],
          globalY - eraserPoint[1]
        );
        
        // If any eraser point is close enough, remove this element point
        if (distance <= eraserSize) {
          return false;
        }
      }
      
      // Keep the point if it's not close to any eraser point
      return true;
    });
    
    console.log(`After erasing: ${newPoints.length} points remain`);
    
    // If we removed all points or too few remain, mark the element as deleted
    if (newPoints.length < 2) {
      console.log(`Deleting linear element ${element.id} as too few points remain`);
      return newElementWith(element, { isDeleted: true });
    }
    
    // Otherwise, update the element with the new points
    return newElementWith(element, { points: newPoints });
  }
}