import { scaleMonoBitmap } from "@/utils/bitmap";
import type { MonoBitmap } from "@/types/project";

type ResourceBitmapPreviewProps = {
  bitmap: MonoBitmap | null;
};

export function ResourceBitmapPreview({ bitmap }: ResourceBitmapPreviewProps) {
  if (!bitmap) {
    return <div className="placeholder-item">还没有导入位图。</div>;
  }

  const svg = scaleMonoBitmap(bitmap, 2);

  return (
    <div className="bitmap-preview">
      <div
        className="bitmap-preview-art"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div className="entity-meta">
        {bitmap.width} x {bitmap.height}
      </div>
    </div>
  );
}
