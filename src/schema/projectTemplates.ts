import { createPicture } from "@/schema/factories";
import { createDefaultProject } from "@/schema/defaultProject";
import type { ProjectDocument } from "@/types/project";

export type ProjectTemplateId = "blank" | "official-demo";

export interface ProjectTemplateDefinition {
  id: ProjectTemplateId;
  label: string;
  description: string;
  createProject: () => ProjectDocument;
}

export function createBlankProject(): ProjectDocument {
  const now = new Date().toISOString();

  return {
    version: 1,
    project: {
      name: "SimpleGUI 空白工程",
      createdAt: now,
      updatedAt: now,
    },
    screen: {
      width: 128,
      height: 64,
      foreground: "#000000",
      background: "#ffffff",
      buffered: true,
    },
    resources: [],
    variables: [],
    timers: [],
    pictures: [createPicture("pic_main", "Main")],
    rules: [],
    simulator: {
      startPictureId: "pic_main",
      keyMode: "dual",
      showGrid: true,
      fps: 20,
    },
  };
}

export const projectTemplates: ProjectTemplateDefinition[] = [
  {
    id: "blank",
    label: "空白工程",
    description: "从一个干净的 128x64 画布开始，自由搭建页面、控件和交互。",
    createProject: createBlankProject,
  },
  {
    id: "official-demo",
    label: "官方例程",
    description: "加载 SimpleGUI 的 DemoMainProcess 官方例程，完整复现控件与交互。",
    createProject: createDefaultProject,
  },
];

export function createProjectFromTemplate(templateId: ProjectTemplateId): ProjectDocument {
  const template = projectTemplates.find((entry) => entry.id === templateId);
  return template?.createProject() ?? createDefaultProject();
}
