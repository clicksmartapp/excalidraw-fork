# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Excalidraw is an open-source virtual hand-drawn style whiteboard, designed to be collaborative and end-to-end encrypted. The project consists of:

1. The core Excalidraw component (`packages/excalidraw`) - a React component that can be embedded in other applications
2. The Excalidraw web application (`excalidraw-app`) - a showcase of the Excalidraw component with additional features like real-time collaboration, end-to-end encryption, and offline support (PWA)
3. Examples showing how to integrate the Excalidraw component in different frameworks
4. Documentation site (in `dev-docs`)

## Environment Requirements

- Node.js 18.x - 22.x
- Yarn 1.22.x (package manager)

## Common Commands

### Installation

```bash
# Install all dependencies for the monorepo
yarn

# Clean installation (removes node_modules and reinstalls)
yarn clean-install
```

### Development

```bash
# Start the development server for the Excalidraw app
yarn start

# Start development server for an example
yarn start:example
```

### Testing

```bash
# Run all tests (typecheck, linting, and unit tests)
yarn test:all

# Run just the unit tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run tests with UI
yarn test:ui

# Update test snapshots
yarn test:update

# Run type checking
yarn test:typecheck

# Run linting
yarn test:code
```

### Building

```bash
# Build the Excalidraw app
yarn build

# Build the Excalidraw package
yarn build:package

# Preview the built app
yarn build:preview
```

### Code Quality

```bash
# Fix code formatting issues
yarn fix

# Fix just code style issues
yarn fix:code

# Fix other formatting issues
yarn fix:other
```

## Project Structure

- `/excalidraw-app/` - The Excalidraw web application
- `/packages/` - Contains all the packages for the project:
  - `/packages/excalidraw/` - The main Excalidraw React component package
  - `/packages/common/` - Common utilities shared across packages
  - `/packages/element/` - Element-related code
  - `/packages/math/` - Math utilities for the project
  - `/packages/utils/` - General utilities
- `/examples/` - Example projects using the Excalidraw component
  - `/examples/with-nextjs/` - Next.js integration example
  - `/examples/with-script-in-browser/` - Browser script integration example
- `/dev-docs/` - Documentation site

## Architecture Overview

Excalidraw is built as a React application with a focus on being embeddable in other projects. The main architecture consists of:

1. A core drawing engine based on Rough.js for the hand-drawn look
2. A React-based UI layer that handles interactions and state management
3. A real-time collaboration system using Firebase and Socket.io (in the web app only)
4. End-to-end encryption for secure collaboration
5. Various utilities for file import/export, image processing, and more

The project uses a monorepo structure with Yarn workspaces to manage the different packages. The main Excalidraw component is published as `@excalidraw/excalidraw` on npm.

## Collaboration Features

For local development with collaboration features, you'll need to set up the [Excalidraw Room server](https://github.com/excalidraw/excalidraw-room) separately.

# Claude Instructions

## model
claude-3-haiku-20240307

## system
You are a helpful, efficient, and concise coding assistant. Focus on writing clean, readable code using best practices. Respond briefly and avoid unnecessary explanations unless asked.

## max_tokens
300

## temperature
0

## top_p
0.9

## stream
true

## stop_sequences
["\n\nHuman:"]

## prompt
I need to enhance the current eraser tool in our canvas application by adding variable size functionality. Currently, the eraser only removes entire strokes, but I'd like to implement pixel-based erasing that adjusts according to user-selected eraser sizes.

Specifically, I need:

- A size slider for the eraser tool that allows users to adjust the eraser diameter  
- Pixel-level erasing functionality that removes only the portions of strokes that intersect with the eraser area  
- Visual feedback showing the current eraser size while using the tool  
- The ability to toggle between full-stroke erasing (current behavior) and pixel-based erasing  

Please implement the necessary UI components like panel to toggle between the erase by pixel and stroke, event handlers, and canvas manipulation functions to support these features. The implementation should maintain performance and work seamlessly with the existing drawing tools.

For the UI, consider adding a size control that appears when the eraser tool is selected, similar to how brush size controls work for drawing tools. For the erasing logic, you'll need to modify how the application handles erase events to check for intersections with pixels rather than entire stroke objects.