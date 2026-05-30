import type { PropsWithChildren, ReactNode } from "react";

type SidebarSectionProps = PropsWithChildren<{
  title: string;
  action?: ReactNode;
}>;

export function SidebarSection({ title, action, children }: SidebarSectionProps) {
  return (
    <section className="sidebar-section">
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}
