import { createDefaultProject } from "@/schema/defaultProject";
import type { Picture, ProjectDocument, VariableDefinition, Widget } from "@/types/project";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function cloneProjectDocument(project: ProjectDocument): ProjectDocument {
  return structuredClone(project);
}

export function formatProjectDocument(project: ProjectDocument): string {
  return JSON.stringify(project, null, 2);
}

export function parseProjectDocument(text: string): ProjectDocument {
  const raw = JSON.parse(text) as unknown;

  if (!isRecord(raw)) {
    throw new Error("Project file must be a JSON object.");
  }

  if (raw.version !== 1) {
    throw new Error("Only version 1 project files are supported.");
  }

  const fallback = createDefaultProject();

  return {
    version: 1,
    project: isRecord(raw.project)
      ? {
          name: typeof raw.project.name === "string" ? raw.project.name : fallback.project.name,
          createdAt:
            typeof raw.project.createdAt === "string"
              ? raw.project.createdAt
              : fallback.project.createdAt,
          updatedAt:
            typeof raw.project.updatedAt === "string"
              ? raw.project.updatedAt
              : fallback.project.updatedAt,
        }
      : fallback.project,
    screen: isRecord(raw.screen)
      ? {
          width: 128,
          height: 64,
          foreground:
            typeof raw.screen.foreground === "string"
              ? raw.screen.foreground
              : fallback.screen.foreground,
          background:
            typeof raw.screen.background === "string"
              ? raw.screen.background
              : fallback.screen.background,
          buffered:
            typeof raw.screen.buffered === "boolean"
              ? raw.screen.buffered
              : fallback.screen.buffered,
        }
      : fallback.screen,
    resources: Array.isArray(raw.resources)
      ? (structuredClone(raw.resources) as ProjectDocument["resources"])
      : [],
    variables: Array.isArray(raw.variables)
      ? (structuredClone(raw.variables) as VariableDefinition[])
      : [],
    timers: Array.isArray(raw.timers)
      ? (structuredClone(raw.timers) as ProjectDocument["timers"])
      : [],
    pictures: Array.isArray(raw.pictures)
      ? (structuredClone(raw.pictures) as Picture[])
      : fallback.pictures,
    rules: Array.isArray(raw.rules) ? (structuredClone(raw.rules) as ProjectDocument["rules"]) : [],
    simulator: isRecord(raw.simulator)
      ? {
          startPictureId:
            typeof raw.simulator.startPictureId === "string"
              ? raw.simulator.startPictureId
              : fallback.simulator.startPictureId,
          keyMode:
            raw.simulator.keyMode === "abstract" ||
            raw.simulator.keyMode === "demoActions" ||
            raw.simulator.keyMode === "dual"
              ? raw.simulator.keyMode
              : fallback.simulator.keyMode,
          showGrid:
            typeof raw.simulator.showGrid === "boolean"
              ? raw.simulator.showGrid
              : fallback.simulator.showGrid,
          fps:
            typeof raw.simulator.fps === "number" ? raw.simulator.fps : fallback.simulator.fps,
        }
      : fallback.simulator,
  };
}

export function findPicture(project: ProjectDocument, pictureId: string): Picture | undefined {
  return project.pictures.find((picture) => picture.id === pictureId);
}

export function findWidget(project: ProjectDocument, widgetId: string): Widget | undefined {
  for (const picture of project.pictures) {
    const widget = picture.widgets.find((entry) => entry.id === widgetId);
    if (widget) {
      return widget;
    }
  }

  return undefined;
}

export function findWidgetPicture(project: ProjectDocument, widgetId: string): Picture | undefined {
  return project.pictures.find((picture) => picture.widgets.some((widget) => widget.id === widgetId));
}
